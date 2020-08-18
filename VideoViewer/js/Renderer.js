"use strict";

const MIN_ZOOM = 0;
const MAX_ZOOM = 3.5;
const ZOOM_STEP = 0.25;  // zooming factor for mouse wheel scroll action

class Renderer {
	constructor(videoBasePath, videos, colorTableArray=LUT['gray'], fps=25, frameCount=50, tileSize=512, fullVideoSize=4096) {
		this.timePerFrameMs = 1000/fps; //this.fps = fps;
		this.frameCount = frameCount;
		this.tileSize = tileSize;
		this.zoom = 0;
		this.vidRes = tileSize;  // width of the actual video resolution
		this.displayRes = tileSize;  // width of canvas in px
		this.videos = videos;  // sequence of videos where each video tree is expected in a separate file folder
		this.currVideoIdx = 0;  // index of the currently active video segment
		this.playing = false;  // suspend animation loop
		this.lastFrameTime = -666;  // (theoretical, because corrected) time of last frame draw (actual draws happen at 60fps)
		this.frameIndex = -1;  // current frame index
		
		this.recentFrameUpdates = Array(fps).fill(0);  // save a bunch of last screen updates to calculate the display FPS
		
		// use fullVideoSize and tileSize to generate tiles
		this.tiles = [];
		var powOffset = Math.log2(tileSize); // Math.log(512) -> 9
		for(var lvl = 0; Math.pow(2, lvl+powOffset) <= fullVideoSize; ++lvl) { // runs 4 times
			var videoUrl = videoBasePath.replace("{lvl}", Math.pow(2, 2*lvl));  // ../mp4/{vid}/t{ 1 4 16 64 }_{x}-{y}.mp4  ->  ../mp4/0/t1_0-0.mp4
			var n = Math.pow(2, lvl);  // [1, 2, 4, 8]
			for(var y=0; y < n; ++y) {
				for(var x=0; x < n; ++x) {
					var videoArray = [];
					videos.forEach((vid) => {
						videoArray.push(videoUrl.replace('{x}', x).replace('{y}', y).replace('{vid}', vid));
					});
					this.tiles.push(new Tile(videoArray, tileSize, n*tileSize, x, y)); // addnew Tile(["{...}/0/t1_0-0.mp4", - "{...}/12/t1_0-0.mp4",], 512, n*tileSize, x, y)
				}
			}
		}
		
		// IE, Edge, Safari only support webgl 1.0 as of 25.09.2017
		this.gl = document.getElementById("canvas").getContext("experimental-webgl");  //this.gl = document.getElementById("canvas").getContext("webgl2");
		if (!this.gl) {
			alert("Sorry, this example requires WebGL");  // eslint-disable-line
			return;
		}
		
		this.setZoomFromWheel(0);
		this.activateTiles();
		

		this.programInfo = twgl.createProgramInfo(this.gl, ["vs", "fs"]);
		this.gl.useProgram(this.programInfo.program);
		
		this.gl.activeTexture(this.gl.TEXTURE0);
		var texColor = twgl.createTexture(this.gl, {
			width: 256,
			height: 1,  // 1D texture
			internalFormat: this.gl.RGBA,  // 4 channels
			target: this.gl.TEXTURE_2D,
			src: colorTableArray,
			min: this.gl.LINEAR,
			wrap: this.gl.CLAMP_TO_EDGE,
		});
		this.gl.uniform1i(this.gl.getUniformLocation(this.programInfo.program, "colorTable"), 0);
		
		this.gl.activeTexture(this.gl.TEXTURE1);
		this.texFrame = twgl.createTexture(this.gl, {
			width: this.tileSize,
			height: this.tileSize,
			internalFormat: this.gl.LUMINANCE,  // uses only 1 channel, this.gl.R8 only works in webgl 2.0
			target: this.gl.TEXTURE_2D,
			src: new Uint8Array(this.tileSize*this.tileSize),
		});
		this.gl.uniform1i(this.gl.getUniformLocation(this.programInfo.program, "segmentTexture"), 1);

		var renderer = this;
		
		// add functions for mouse interactinos
		this.gl.canvas.onmousedown = function(e) { renderer.mousedown = [e.screenX + window.scrollX, e.screenY + window.scrollY]; };
		this.gl.canvas.onmouseup = function(e) { renderer.mousedown = null; };
		this.gl.canvas.onmouseleave = function(e) { renderer.mousedown = null; };
		this.gl.canvas.onmousemove = function(e) {
			if(renderer.mousedown != null) {
				window.scrollTo(renderer.mousedown[0] - e.screenX, renderer.mousedown[1] - e.screenY);
				renderer.mousedown = [e.screenX + window.scrollX, e.screenY + window.scrollY];
				renderer.activateTiles();
			}
		};
		window.addEventListener("wheel", e => {
			renderer.setZoomFromWheel(Math.sign(e.deltaY) * ZOOM_STEP, e.clientX, e.clientY);
			e.preventDefault();
			return false;
		}, {passive: false});
		
		// add functions for touch interactions
		var mc = new Hammer.Manager(this.gl.canvas, {
			touchAction: 'pan-x pan-y',
			recognizers: [ [Hammer.Pinch, {}] ]     //  [Hammer.Pan, { direction: Hammer.DIRECTION_VERTICAL }],
		});
		mc.on('pinch', function(ev) {
			if(ev.eventType > 2) { // event finished. 1 = start, 2 = move, 4 = end, 8 = cancel
				ev.target.style.width = parseFloat(ev.target.style.width)*ev.scale + "px"; 
				ev.target.style.transform = "";
				renderer.setZoomFromPinch();
			} else {
				if(ev.eventType == Hammer.INPUT_START) {
					renderer.pinchCenter = {  // get 0..1 coordinates on old canvas size
						x: (ev.center.x + window.scrollX) / renderer.displayRes,
						y: (ev.center.y + window.scrollY) / renderer.displayRes
					}
				}
				ev.target.style.transform = "scale(" + ev.scale + ")";
				
				// calculate viewport offset
				var scrollX = renderer.pinchCenter.x * renderer.displayRes * ev.scale - ev.center.x;
				var scrollY = renderer.pinchCenter.y * renderer.displayRes * ev.scale - ev.center.y;
				window.scrollTo(scrollX, scrollY);
			}
		});
	}
	
	start() {
		this.playing = true;
		requestAnimationFrame(this.render.bind(this));
	}
	
	stop() {
		this.playing = false;
	}
	
	render(time) { 
		if(!this.playing) { return; }  // abort loop entirely
		
		requestAnimationFrame(this.render.bind(this));
		var elapsed = time - this.lastFrameTime; 
		if(elapsed < this.timePerFrameMs) { return; }  // skip this frame
		
		this.lastFrameTime = time - (elapsed % this.timePerFrameMs);  // update last draw time with respect to this function running at fixed frame rate (usually 60fps)
	
		this.frameIndex = (this.frameIndex + 1) % (this.frameCount * this.videos.length);
		if(this.frameIndex >= this.frameCount * (this.currVideoIdx+1) || this.frameIndex < this.frameCount * this.currVideoIdx) {
			// advance to next video segment if frame to be drawn is not in the current segment
			this.currVideoIdx = (this.currVideoIdx + 1) % this.videos.length;
			this.tiles.forEach(function (tile) { tile.nextSegment(); }, this);
		}
		var curFrameIdx = this.frameIndex % this.frameCount;
		
		var nextFrameIsReady = true;
		for(var i=0; i < this.tiles.length; ++i) {
			if(this.tiles[i].isActive && this.tiles[i].frames[this.currVideoIdx].length <= curFrameIdx) {
				nextFrameIsReady = false;
				break; 
			}
		}
		if(nextFrameIsReady) {
			// twgl.resizeCanvasToDisplaySize(this.gl.canvas);
			this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
		
			this.tiles.forEach(function (tile) {
				tile.render(this.gl, curFrameIdx, this.programInfo, this.texFrame);
			}, this);
			
			this.recentFrameUpdates.push(time);
			this.recentFrameUpdates.shift();
		} else {
			console.warn("next frame isn't ready, buffering..."); 
			this.lastFrameTime += 500; // pause execution for a bit until enough is cached
			// todo consider adjusting frame rate and undo increment of frameIndex and currVideoIdx (also in every tile) bc otherwise one frame is skipped...
			// framerate: could (generally) be done depending on pre-buffered frames, when enough frames are ready, play "full 25 fps".
			// undo increment: after a stop one skipped frame isnt a big problem.
		}
	}
	
	setZoomFromWheel(zoomChange, x, y) {
		// get 0..1 coordinates on old canvas size
		var canvX = (x + window.scrollX) / this.displayRes;
		var canvY = (y + window.scrollY) / this.displayRes;
		
		this.zoom -= zoomChange;
		this.zoom = Math.min(MAX_ZOOM, this.zoom);
		this.zoom = Math.max(MIN_ZOOM, this.zoom);
		
		this.displayRes = Math.pow(2, this.zoom) * this.tileSize;
		this.gl.canvas.style.width = this.displayRes + "px";  // display size of canvas
		
		this.vidRes = Math.pow(2, parseInt(this.zoom + ZOOM_STEP)) * this.tileSize;
		this.gl.canvas.width = this.vidRes;
		this.gl.canvas.height = this.vidRes;
		
		window.scrollTo(canvX * this.displayRes - x, canvY * this.displayRes - y);  // calculate viewport offset
		this.activateTiles();
	}
	
	setZoomFromPinch() { 
		this.displayRes = parseFloat(this.gl.canvas.style.width);
		this.zoom = Math.log2(this.displayRes / this.tileSize);
		this.zoom = Math.round(this.zoom/ZOOM_STEP)*ZOOM_STEP;  // snap to zoom step
		
		this.vidRes = Math.pow(2, parseInt(this.zoom)) * this.tileSize;
		this.gl.canvas.width = this.vidRes;
		this.gl.canvas.height = this.vidRes;
		
		this.activateTiles();
	}
	
	activateTiles() {
		var frameborder = 0;
		var cssTileSize = this.tileSize * this.displayRes / this.vidRes;
		var startX = parseInt((window.scrollX + frameborder) / cssTileSize);
		var endX = parseInt((window.scrollX + window.innerWidth - frameborder) / cssTileSize);
		var startY = parseInt((window.scrollY  + frameborder) / cssTileSize);
		var endY = parseInt((window.scrollY + window.innerHeight - frameborder) / cssTileSize);
		this.tiles.forEach(function (tile) {
			if(tile.canvRes == this.vidRes && tile.x >= startX && tile.x <= endX && tile.y >= startY && tile.y <= endY) {
				tile.activate();  // init (load and decode) if necessary
			} else {
				tile.deactivate();
			}
		}, this);
	}
	
	getAvgDecodingTime() {
		var avgFrameTime = (this.recentFrameUpdates[this.recentFrameUpdates.length-1] - this.recentFrameUpdates[0]) / (this.recentFrameUpdates.length - 1);

		if(this.totalDecodedFrames <= 0) { return 0; }
		return Math.round(1000 / avgFrameTime);
	}
}
