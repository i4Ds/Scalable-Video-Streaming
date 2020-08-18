"use strict";

class Tile {
    constructor(videoUrls, vidRes, canvRes, x, y, nBuffer=2, nCache=5) {
        this.isInitialized = false;
		this.isActive = false;
		this.isBuffering = true;
		
		this.videoUrls = videoUrls;
        this.frames = null;
		this.currentVideoIdx = 0;
		this.decodingVideoIdx = 0;
		this.currDecoded = 0;
		this.nBuffer = nBuffer;
		
		// select random nCache segments to cache for this tile
		this.cacheSegments = Array(videoUrls.length).fill(0).map((e, i) => i);  // array 0..n //[0..12].length -> 13
		while(this.cacheSegments.length > nCache) {  // remove random entry until nCache elements are left
			this.cacheSegments.splice(Math.floor(Math.random() * Math.floor(this.cacheSegments.length)), 1);
		}
		
		this.vidRes = vidRes;
		this.canvRes = canvRes;
        this.x = x;
        this.y = y;

		var maxXY = canvRes / vidRes; // [1,2,4,8]
        var scale = 1 / maxXY;
        var offX = scale * (2*x - maxXY + 1);
        var offY = scale * (2*y - maxXY + 1);
        var Mscale = twgl.m4.scaling([scale, scale, scale]);
        var Mtrans = twgl.m4.translation([offX, -offY, 0]);
        this.posMat = twgl.m4.multiply(Mtrans, Mscale);
        this.arrays = {
            vPosition: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
            vTexCoord: [0, 1, 1, 1, 1, 0, 0, 0],
            indices: [0, 1, 2, 0, 2, 3],
        };

		this.decodedFrames = 0;
    }

    render(gl, frameIndex, programInfo, texFrame) {
		if (this.isActive && this.frames[this.currentVideoIdx].length > frameIndex) {
			twgl.setTextureFromArray(gl, texFrame, this.frames[this.currentVideoIdx][frameIndex], {
				width: this.vidRes,
                height: this.vidRes,
                internalFormat: gl.LUMINANCE,  // uses only 1 channel, gl.R8 only works in webgl 2.0
                target: gl.TEXTURE_2D,
			});
			
			twgl.setUniforms(programInfo, { modelView: this.posMat });

            var bufferInfo = twgl.createBufferInfoFromArrays(gl, this.arrays);
            twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
            twgl.drawBufferInfo(gl, bufferInfo);
        }
    }
	
	activate() {
		if(!this.isActive) {
			clearTimeout(this.freeMemEvent); console.log('activated', this.canvRes+"-"+this.x+"-"+this.y);
			this.isActive = true;
			if(!this.isInitialized) {
				this.init();
			}
		}
	}
	
	deactivate() {
		if(this.isActive) {
			this.isActive = false; console.log('deactivated', this.canvRes+"-"+this.x+"-"+this.y);
			this.freeMemEvent = setTimeout(function() {
				this.isInitialized = false;
				this.isBuffering = true;
				this.preload.removeAllEventListeners()
				delete this.preload;
				delete this.frames;
				delete this.avc;
				console.log('frames deleted', this.canvRes+"-"+this.x+"-"+this.y);
			}.bind(this), 2000); // free memory after 2s
		}
	}
	
	nextSegment() {  // "activate" next video segment
		if(this.isActive) {
			// decode next video?
			if(!this.isBuffering) {
				if(this.frames[this.decodingVideoIdx].length == 0) {
					this.buffering = true;
					this.preload.loadFile({ src: this.videoUrls[this.decodingVideoIdx], type: createjs.AbstractLoader.BINARY });
				} else {
					this.decodingVideoIdx = (this.decodingVideoIdx + 1) % this.videoUrls.length;
				}
			} else if(this.decodingVideoIdx == this.currentVideoIdx) {
				console.warn("current Segment-idx is getting ahead of segment being decoded!", this.canvRes+"-"+this.x+"-"+this.y + " (" + this.decodingVideoIdx + ")"); 
				// todo "deactivate" (stop loading/decoding) current and start decoding next (?)
				// what happens here for the moment is it just waits for the next frame to be ready, e.g. buffering takes a bit longer than necessary
			}
			
			// if current segment isnt a cached one, delete and decrement this.currDecoded
			if(!this.cacheSegments.includes(this.currentVideoIdx) && this.decodingVideoIdx != this.currentVideoIdx) {
				this.frames[this.currentVideoIdx] = [];  // remove current segment
				--this.currDecoded;
			}
		}
		
		this.currentVideoIdx = (this.currentVideoIdx + 1) % this.videoUrls.length;
	}

    init() {
		this.isInitialized = true;
        this.frames = [...Array(this.videoUrls.length)].map(x=>[]);  // create an array with n empty arrays
		this.decodingVideoIdx = this.currentVideoIdx;
		
        this.avc = new Decoder();
        this.avc.onPictureDecoded = function(buffer, width, height, infos) {
			if(this.isInitialized) {
				var data = new Uint8Array(buffer.slice(0, this.vidRes * this.vidRes), 0, this.vidRes * this.vidRes);
				this.frames[this.decodingVideoIdx].push(data);
			}
        }.bind(this);

        this.preload = new createjs.LoadQueue();
        this.preload.addEventListener("fileload", this.decode.bind(this)); // this.preload.addEventListener("fileload", function(event) { this.decode(event.result); }.bind(this));
        this.preload.loadFile({ src: this.videoUrls[this.decodingVideoIdx], type: createjs.AbstractLoader.BINARY });
    }

	// inspired by: https://github.com/mbebenita/Broadway/issues/68#issuecomment-99754002
    decode(event) {
		this.buffering = true;
        this.reader = new MP4Reader(new Bytestream(event.result));
        this.reader.read();
        var video = this.reader.tracks[1];
        var _avc = video.trak.mdia.minf.stbl.stsd.avc1.avcC;
        var sps = _avc.sps[0];
        var pps = _avc.pps[0];

        /* Decode Sequence & Picture Parameter Sets */
		this.avc.decode(sps);
        this.avc.decode(pps);

        /* Decode Pictures */
        var imgIdx = 0
		
		setTimeout(function decodeNext() {
			if(!this.isInitialized) return;
			
			var units = video.getSampleNALUnits(imgIdx++);
			if(units.length > 0) {
				setTimeout(decodeNext.bind(this), 1);  // has min delay of 4ms on most browsers
				units.forEach(function (nal) { this.avc.decode(nal); }.bind(this));
			} else {
				function doneDecoding() {
					if(this.frames[this.decodingVideoIdx].length + 1 == imgIdx) {  // last image with 0 units does not create a onPictureDecoded event
						delete this.reader;
						console.log('done decoding. removed reader object', this.canvRes+"-"+this.x+"-"+this.y + " (" + this.decodingVideoIdx + ")");
						this.decodedFrames += this.frames[this.decodingVideoIdx].length;
						++this.currDecoded;
						
						do {  // increment decodingVideoIdx, skip cached (already loaded) videos
							this.decodingVideoIdx = (this.decodingVideoIdx + 1) % this.videoUrls.length;
							var modularDistance = this.decodingVideoIdx - this.currentVideoIdx + (this.currentVideoIdx > this.decodingVideoIdx ? this.videoUrls.length : 0);
						} while(this.frames[this.decodingVideoIdx].length > 0 && modularDistance <= this.nBuffer && this.currDecoded < this.videoUrls.length);
						
						
						if(modularDistance <= this.nBuffer && this.currDecoded < this.videoUrls.length && this.isActive) {
							this.preload.loadFile({ src: this.videoUrls[this.decodingVideoIdx], type: createjs.AbstractLoader.BINARY });
						} else {
							this.isBuffering = false;
						}
					} else {  // onPictureDecoded hasn't been called yet..
						console.log('waiting for onPictureDecoded callback... (called' + this.frames[this.decodingVideoIdx].length + "/" + (imgIdx-1) + " times)", this.canvRes+"-"+this.x+"-"+this.y + " (" + this.decodingVideoIdx + ")");
						setTimeout(doneDecoding.bind(this), 10);  // try again in 10ms
					}
				};
				doneDecoding.bind(this)();
			}
		}.bind(this), 1);  // a while loop would be faster since browsers typically implement a min-delay of 4ms, but it would also be blocking, resulting in short stops
    }
}