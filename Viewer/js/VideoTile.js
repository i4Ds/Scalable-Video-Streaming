var VideoTile = function () {
    // FF performance: https://rejzor.wordpress.com/2015/06/14/improve-firefox-html5-video-playback-performance/
    const videoElement = document.createElement('video');

    videoElement.autoplay = false;
    videoElement.muted = true;
    videoElement.loop = true;
    videoElement.type = "video/mp4";

    this.element = videoElement;

    this._eventListeners = {
        'ready': []
    }
};

VideoTile.prototype.ready = false;

VideoTile.prototype.fetch = function (url) {

    var playing = false;
    var timeupdate = false;

    // Waiting for these 2 events ensures
    // there is data in the video

    /*this.element.addEventListener('playing', function () {
        playing = true;
        checkReady();
    }, { once: true });

    this.element.addEventListener('timeupdate', function () {
        timeupdate = true;
        checkReady();
    }, { once: true });*/

    this.element.addEventListener('canplay', function () {
        this.ready = true;
        this.dispatchEvent('ready');
    }.bind(this), { once: true });

    this.element.src = url;
    //this.element.play();

    var checkReady = function () {
        if (playing && timeupdate) {
            this.ready = true;
            this.dispatchEvent('ready');
        }
    }.bind(this);
};

VideoTile.prototype.addEventListener = function (eventStr, callback, options) {
    this._eventListeners[eventStr].push([callback, options]);
};

VideoTile.prototype.dispatchEvent = function (eventStr, data) {
    var evs = this._eventListeners[eventStr];
    for (var evi in evs) {
        var ev = evs[evi];
        var cb = ev[0];
        if (ev.length >= 1 && ev[1] !== undefined && ev[1].once === true) {
            var i = this._eventListeners[eventStr].indexOf(ev);
            this._eventListeners[eventStr].splice(i, 1);
        }
        cb(data);
    }
};