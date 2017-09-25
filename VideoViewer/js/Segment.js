//"use strict";

class Segment {
    constructor(video, resolution, x, y) {
        this.videoUrl = video;
        this.counter = 0;
        this.frames = {};

        this.resolution = resolution;
        this.x = x;
        this.y = y;

        var test = resolution / 128;
        var scale = 1 / test;

        var offX = scale * (2*x - test);
        var offY = scale * (2*y - test);

        var Mscale = twgl.m4.scaling([scale, scale, scale]);
        var Mtrans = twgl.m4.translation([offX, -offY, 0]);
        this.posMat = twgl.m4.multiply(Mtrans, Mscale);
        
        this.arrays = {
            vPosition: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
            vTexCoord: [0, 1, 1, 1, 1, 0, 0, 0],
            indices: [0, 1, 2, 0, 2, 3],
        };
    }

    render(gl, frameIndex, programInfo, lutTex) {
        if (this.counter > frameIndex) {

            var tex = twgl.createTexture(gl, {
                width: 128,
                height: 128,
                // gl.R8 only works in webgl 2.0
                //internalFormat: gl.R8,
                internalFormat: gl.LUMINANCE,
                target: gl.TEXTURE_2D,
                src: this.frames[frameIndex],
            });

            var uniforms = {
                segmentTexture: tex,
                modelView: this.posMat
            };

            var bufferInfo = twgl.createBufferInfoFromArrays(gl, this.arrays);
            twgl.setUniforms(programInfo, uniforms);
            twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
            twgl.drawBufferInfo(gl, bufferInfo);
        }
    }

    init() {
        var self = this;
        this.avc = new Decoder();
        this.avc.onPictureDecoded = function (buffer, width, height, infos) {
            var data = new Uint8Array(buffer, 0, 128 * 128);
            //var index = 0;
            //for (var i = 0; i < 128 * 128; i++) {
            //    data[index++] = buffer[i];
            //}

            self.frames[self.counter] = data;
            self.counter++;
            
            if (self.counter >= 64) {
                delete self.reader;
                delete self.avc;
            }
        };

        function onVideoLoaded(event) {
            self.decode(event.result);
        }
        
        var preload = new createjs.LoadQueue();
        preload.addEventListener("fileload", onVideoLoaded);
        preload.loadFile({ src: this.videoUrl, type: createjs.AbstractLoader.BINARY });
    }

// source: https://github.com/mbebenita/Broadway/issues/68#issuecomment-99754002
    decode(rawData) {
        this.reader = new MP4Reader(new Bytestream(rawData));
        this.reader.read();

        var video = this.reader.tracks[1];
        //this.size = new Size(video.trak.tkhd.width, video.trak.tkhd.height);
        var avc = video.trak.mdia.minf.stbl.stsd.avc1.avcC;
        var sps = avc.sps[0];
        var pps = avc.pps[0];

        /* Decode Sequence & Picture Parameter Sets */
        this.avc.decode(sps);
        this.avc.decode(pps);

        /* Decode Pictures */
        var pic = 0;
        setTimeout(function foo() {
            var avc = this.avc;
            video.getSampleNALUnits(pic).forEach(function (nal) {
                avc.decode(nal);
            });
            pic++;
            if (pic < 3000) {
                setTimeout(foo.bind(this), 1);
            }
        }.bind(this), 1);
    }
}