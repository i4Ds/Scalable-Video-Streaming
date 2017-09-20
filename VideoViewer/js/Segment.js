class Segment {
    constructor(video, context) {
        this.videoUrl = video;
        this.context = context;
        this.counter = 0;
        this.frames = {};
    }

    init() {
        self = this;
        this.avc = new Decoder();
        this.avc.onPictureDecoded = function (buffer, width, height, infos) {
            var imgData = self.context.createImageData(128, 128);
            var index = 0;
            for (var i = 0; i < 128 * 128; i++) {
                for (var k = 0; k < 3; k++) {
                    imgData.data[index++] = buffer[i];
                }
                // alpha
                imgData.data[index++] = 255;
            }

            //imgData.data.set(buffer);
            self.context.putImageData(imgData, 0, 0);

            self.frames[self.counter] = imgData;
            self.counter++;
        };

        function onVideoLoaded(event) {
            console.log("loaded");
            self.decode(event.result);
        };

        console.log(this.videoUrl);

        var preload = new createjs.LoadQueue();
        
        preload.addEventListener("fileload", onVideoLoaded);
        preload.loadFile({ src: this.videoUrl, type: createjs.AbstractLoader.BINARY });
    }

// source: https://github.com/mbebenita/Broadway/issues/68#issuecomment-99754002
    decode(rawData) {
        console.log("decoding");

        var tmp = new Bytestream(rawData);

        this.reader = new MP4Reader(tmp);
        this.reader.read();
        var video = this.reader.tracks[1];
        this.size = new Size(video.trak.tkhd.width, video.trak.tkhd.height);

        console.info("MP4Player::readAll(), length: " + this.reader.stream.length);

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
            };
        }.bind(this), 1);
    }
}