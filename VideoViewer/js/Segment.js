//"use strict";

class Segment {
    constructor(video, vidRes, canvRes, x, y) {
        this.isInitialized = false;
		this.isActive = false;
		this.finishedDecodingCallback = () => {};
		this.decoded = false;
		
		this.videoUrl = video;
        this.counter = 0;
        this.frames = {};

		this.vidRes = vidRes;
		this.canvRes = canvRes;
        this.x = x;
        this.y = y;

        var maxXY = canvRes / vidRes;
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
    }

    render(gl, frameIndex, programInfo, texFrame) {
		if (this.isActive && this.counter > frameIndex) {
			twgl.setTextureFromArray(gl, texFrame, this.frames[frameIndex], {
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
	
	activate(callback) {
		this.finishedDecodingCallback = callback;
		if(!this.isActive) {
			clearTimeout(this.freeMemEvent); console.log('activated', this.canvRes+"-"+this.x+"-"+this.y);
			this.isActive = true;
			if(!this.isInitialized) {
				this.init();
			}
		}
		return this.decoded ? false : true;
	}
	
	deactivate() {
		if(this.isActive) {
			this.isActive = false; console.log('deactivated', this.canvRes+"-"+this.x+"-"+this.y);
			this.freeMemEvent = setTimeout(function() {
				this.isInitialized = false;
				this.decoded = false;
				delete this.frames;  console.log('frames deleted', this.canvRes+"-"+this.x+"-"+this.y);
			}.bind(this), 2000); // free memory after 2s
		}
	}

    init() {
		this.isInitialized = true;
		this.counter = 0;
        this.frames = {};
		
        this.avc = new Decoder();
        this.avc.onPictureDecoded = function(buffer, width, height, infos) {
            var data = new Uint8Array(buffer, 0, this.vidRes * this.vidRes);
            this.frames[this.counter++] = data;
        }.bind(this);

        var preload = new createjs.LoadQueue();
        preload.addEventListener("fileload", function(event) { 
			this.decode(event.result);
		}.bind(this));
        preload.loadFile({ src: this.videoUrl, type: createjs.AbstractLoader.BINARY });
    }

// source: https://github.com/mbebenita/Broadway/issues/68#issuecomment-99754002
    decode(rawData) {
        this.reader = new MP4Reader(new Bytestream(rawData));
        this.reader.read();

        var video = this.reader.tracks[1];
        //this.size = new Size(video.trak.tkhd.width, video.trak.tkhd.height);
        var _avc = video.trak.mdia.minf.stbl.stsd.avc1.avcC;
        var sps = _avc.sps[0];
        var pps = _avc.pps[0];

        /* Decode Sequence & Picture Parameter Sets */
        this.avc.decode(sps);
        this.avc.decode(pps);

        /* Decode Pictures */
        var imgIdx = 0
		clearInterval(this.decodeNextInterval);
        this.decodeNextInterval = setInterval(function() {
			var units = video.getSampleNALUnits(imgIdx++);
			if(units.length > 0 && this.isInitialized) {
				units.forEach(function (nal) {
					this.avc.decode(nal);
				}.bind(this));
			} else {
				clearInterval(this.decodeNextInterval);
				var cleanup = setInterval(function foo() {
					if(this.counter + 1 == imgIdx) {  // last image with 0 units does not create a onPictureDecoded event
						clearInterval(cleanup);
						this.decoded = true;
						delete this.reader;
						delete this.avc;
						console.log('done decoding: removed video, reader and avc objects', this.canvRes+"-"+this.x+"-"+this.y);
						this.finishedDecodingCallback(this);
					} else {
						console.log('nup', this.canvRes+"-"+this.x+"-"+this.y);  // TODO this occurs sometime! (load error?)
					}
				}.bind(this), 100);
			}
		}.bind(this), 1);
    }
}