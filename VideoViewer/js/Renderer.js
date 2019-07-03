"use strict";

const TILE_SIZE = 512;
const MIN_ZOOM = 0;
const MAX_ZOOM = 3.5;
const ZOOM_STEP = 0.25;

class Renderer {
	constructor(segments, colorTableArray=LUT['gray'], fps=25, frameCount=50, folders=[]) {
		this.segments = segments;
		this.nextSegments = null;
		this.fps = fps;
		this.frameCount = frameCount;
		this.zoom = 0;
		this.vidRes = TILE_SIZE;
		this.displayRes = TILE_SIZE;
		this.folders = folders;  // sequence of videos where each video tree is expected in a separate file folder
		this.currFolderIdx = 0;
		this.playing = false;
		
		this.totalDecodedFrames = 0;
		this.totalDecodingTime = 0;
		
		// IE, Edge, Safari only support webgl 1.0 as of 25.09.2017
		this.gl = document.getElementById("canvas").getContext("experimental-webgl");  //this.gl = document.getElementById("canvas").getContext("webgl2");
		if (!this.gl) {
			alert("Sorry, this example requires WebGL");  // eslint-disable-line
			return;
		}
		
		this.setZoomFromWheel(0);
		this.activateSegments();
		

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
			width: TILE_SIZE,
			height: TILE_SIZE,
			internalFormat: this.gl.LUMINANCE,  // uses only 1 channel, this.gl.R8 only works in webgl 2.0
			target: this.gl.TEXTURE_2D,
			src: new Uint8Array(TILE_SIZE*TILE_SIZE),
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
				renderer.activateSegments();
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
		var frameIndex = Math.round(time / 1000 * this.fps) % (this.frameCount * Math.max(1, this.folders.length));
		if(frameIndex >= this.frameCount * (this.currFolderIdx+1) || frameIndex < this.frameCount * this.currFolderIdx) {
			if(this.nextSegments == null) {
				this.loadNextSegments();
			}
			this.segments.forEach(function (seg) {
				this.totalDecodedFrames += seg.decodedFrames; seg.decodedFrames = 0;
				this.totalDecodingTime += seg.decodingTime; seg.decodingTime = 0;
				seg.deactivate();
			}, this);  // deactivate all old segments
			this.segments = this.nextSegments;
			this.nextSegments = null;
			this.currFolderIdx = (this.currFolderIdx + 1) % this.folders.length;
			this.activateSegments();  // activate new segments
		}
		var curFrameIdx = frameIndex % this.frameCount;
		
		var nextFrameIsReady = true;
		var allDecoded = true;
		for(var i=0; i < this.segments.length; ++i) {
			if(!this.segments[i].decoded) {
				allDecoded = false;
			}
			if(this.segments[i].isActive && this.segments[i].counter <= curFrameIdx) {
				nextFrameIsReady = false;
				break;
			}
		}
		
		if(allDecoded && this.nextSegments !== null) {
			this.loadNextSegments();
		}
		
		if(this.playing) {
			// twgl.resizeCanvasToDisplaySize(this.gl.canvas);
			this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
			
			if(nextFrameIsReady) {
				this.segments.forEach(function (segment) {
					segment.render(this.gl, curFrameIdx, this.programInfo, this.texFrame);
				}, this);
			}
			
			requestAnimationFrame(this.render.bind(this));
		}
	}
	
	setZoomFromWheel(zoomChange, x, y) {
		// get 0..1 coordinates on old canvas size
		var canvX = (x + window.scrollX) / this.displayRes;
		var canvY = (y + window.scrollY) / this.displayRes;
		
		this.zoom -= zoomChange;
		this.zoom = Math.min(MAX_ZOOM, this.zoom);
		this.zoom = Math.max(MIN_ZOOM, this.zoom);
		
		this.displayRes = Math.pow(2, this.zoom) * TILE_SIZE;
		this.gl.canvas.style.width = this.displayRes + "px";  // display size of canvas
		
		this.vidRes = Math.pow(2, parseInt(this.zoom + ZOOM_STEP)) * TILE_SIZE;
		this.gl.canvas.width = this.vidRes;
		this.gl.canvas.height = this.vidRes;
		
		window.scrollTo(canvX * this.displayRes - x, canvY * this.displayRes - y);  // calculate viewport offset
		this.activateSegments();
	}
	
	setZoomFromPinch() { 
		this.displayRes = parseFloat(this.gl.canvas.style.width);
		this.zoom = Math.log2(this.displayRes / TILE_SIZE);
		this.zoom = Math.round(this.zoom/ZOOM_STEP)*ZOOM_STEP;  // snap to zoom step
		
		this.vidRes = Math.pow(2, parseInt(this.zoom)) * TILE_SIZE;
		this.gl.canvas.width = this.vidRes;
		this.gl.canvas.height = this.vidRes;
		
		this.activateSegments();
	}
	
	activateSegments() {
		var frameborder = 0;
		var cssTileSize = TILE_SIZE * this.displayRes / this.vidRes;
		var startX = parseInt((window.scrollX + frameborder) / cssTileSize);
		var endX = parseInt((window.scrollX + window.innerWidth - frameborder) / cssTileSize);
		var startY = parseInt((window.scrollY  + frameborder) / cssTileSize);
		var endY = parseInt((window.scrollY + window.innerHeight - frameborder) / cssTileSize);
		this.segments.forEach(function (seg) {
			if(seg.canvRes == this.vidRes && seg.x >= startX && seg.x <= endX && seg.y >= startY && seg.y <= endY) {
				seg.activate();  // init (load and decode) if necessary
			} else {
				seg.deactivate();
			}
		}, this);
	}
	
	loadNextSegments() {
		var currFolderStr = "/" + this.folders[this.currFolderIdx] + "/";
		var nextFolderStr = "/" + this.folders[(this.currFolderIdx + 1) % this.folders.length] + "/";
		this.nextSegments = [];
		this.segments.forEach(function (seg) {
			var newSeg = new Segment(seg.videoUrl.replace(currFolderStr, nextFolderStr), seg.vidRes, seg.canvRes, seg.x, seg.y)
			if(seg.active) {  // if the newly added segment corresponds to a current active one, init (load and decode) next one
				newSeg.init();  // init (load and decode) if necessary
			}
			this.nextSegments.push(newSeg);
		}, this);
		console.log("load next segment. " + currFolderStr + " -> " + nextFolderStr + "  frames: " + this.segments.length);
	}
	
	getAvgDecodingTime() {
		if(this.totalDecodedFrames == 0) { return 0; }
		return Math.round(this.totalDecodingTime / this.totalDecodedFrames * 1000) / 1000;
	}
}
