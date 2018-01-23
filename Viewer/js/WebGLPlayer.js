// https://stackoverflow.com/questions/31006399/webgl-asynchronous-teximage2d
// https://stackoverflow.com/questions/9863969/updating-a-texture-in-opengl-with-glteximage2d
var WebGLPlayer = function (videos, initMode) {
    if (!Detector.webgl) Detector.addGetWebGLMessage();

    this.stats = new Stats();
    this.stats.showPanel(1);
    document.body.appendChild(this.stats.dom);
    $(this.stats.dom).css('left', '150px');

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
    this.camera.position.z = 500;

    this.container = document.getElementById('container');

    this.controls = new THREE.TrackballControls(this.camera, this.container);
    this.controls.noPan = true;

    this.controls.rotateSpeed = 1.0;
    this.controls.zoomSpeed = 1.2;
    this.controls.panSpeed = 0.8;

    this.controls.noZoom = false;
    this.controls.noPan = false;

    this.controls.staticMoving = true;
    this.controls.dynamicDampingFactor = 0.3;

    this.controls.keys = [65, 83, 68];

    this.videos = videos;

    //controls.addEventListener('change', render);

    // world

    this.scene = new THREE.Scene();
    window.scene = this.scene;
    this.scene.background = new THREE.Color(0xcccccc);    
    var light = new THREE.AmbientLight(0xFFFFFF);
    this.scene.add(light);
    
    // renderer
    this.frameCount = 0;
    this.frameStart = performance.now();
    this.renderer = new THREE.WebGLRenderer({ antialias: false }); //, preserveDrawingBuffer: true
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.currentRenderTarget = 0;
    /*var renderTargetOptions = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.LuminanceFormat };
    this.renderBuffers = [
        new THREE.WebGLRenderTarget(4096, 4096, renderTargetOptions),
        new THREE.WebGLRenderTarget(4096, 4096, renderTargetOptions)
    ];*/

    this.container.appendChild(this.renderer.domElement);

    
    this.setMode = function (mode) {
        console.log('Switching to ' + mode);
        // clear stuff
        if (this.worker !== undefined) this.worker.terminate();
        if (this.__spheres !== undefined) {
            for (var i = 0; i < this.__spheres.length; i++) {
                this.scene.remove(this.__spheres[i]);
                this.__spheres[i] = undefined;
                this.__materials[i].dispose();
                this.__geometry[i].dispose();
                this.__textures[i].dispose();
                this.__materials[i] = undefined;
                this.__geometry[i] = undefined;
                this.__textures[i] = undefined;
            }
            this.__spheres = undefined;
        }
        if (this.__sphereMesh !== undefined) {
            this.scene.remove(this.__sphereMesh);
            this.__sphereMat.dispose();
            this.__sphereGeom.dispose();
            this.videoTexture.dispose();
            this.__sphereMesh = undefined;
            this.__sphereMat = undefined;
            this.__sphereGeom = undefined;
        }
        $('#videoCanvas').remove();

        // set new mode
        if (mode == '64spheres') {
            this.__spheres = [];
            this.__materials = [];
            this.__geometry = [];
            this.__textures = [];
            for (var i = 0; i < 64; i++) {
                var geometry = new THREE.SphereGeometry(100, i == 11 ? 32 : 4, i == 11 ? 32 : 4);

                var texture = new THREE.VideoTexture(this.videos[i]);
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.format = THREE.RGBFormat; // AlphaFormat possible?
                texture.needsUpdate = true;
                var material = new THREE.MeshPhongMaterial({ color: 0xffffff, map: texture, flatShading: false });
                material.needsUpdate = true;

                var mesh = new THREE.Mesh(geometry, material);
                //mesh.position.x = mr * Math.cos(i/64 * Math.PI * 2)
                //mesh.position.y = mr * Math.sin(i / 64 * Math.PI * 2);
                if (i != 11) mesh.position.x -= 500;
                mesh.updateMatrix();
                mesh.matrixAutoUpdate = false;
                this.scene.add(mesh);
                this.__spheres.push(mesh);
                this.__materials.push(material);
                this.__geometry.push(geometry);
                this.__textures.push(texture);
            }
        } else {

            // INFO: Currently OffscreenCanvas has practically no support in browsers.
            /*var canvas = $('<canvas id="videoCanvas" height="512" width="512"></canvas>');
            canvas.css({
                'position': 'absolute',
                'left': -10000,
                'top': -10000,
                'z-index': 50000,
                'display': 'none'
            });
            $(document.body).append(canvas);
            this.videoDrawContext = canvas[0].getContext('2d');*/
            
            this.videoTexture = new UpdatableVideoTexture(THREE.LuminanceFormat);
            this.videoTexture.setRenderer(this.renderer);

            var geometry = new THREE.SphereGeometry(100, 32, 32);
            var vt = this.videoTexture;
            var material = new THREE.MeshPhongMaterial({ color: 0xffffff, map: vt, flatShading: false });
            var mesh = new THREE.Mesh(geometry, material);
            mesh.updateMatrix();
            mesh.matrixAutoUpdate = false;
            this.scene.add(mesh);
            this.__sphereMesh = mesh;
            this.__sphereMat = material;
            this.__sphereGeom = geometry;

            this.renderBlack = false;

            this.renderer.render(this.scene, this.camera);
            this.videoTexture.initRender(this.videos[0].element, 512, 512);

            /*if (window.Worker) {
                this.worker = new Worker('js/VideoLoader.js');
                this.worker.onmessage = this.frameReceived.bind(this);
            } else {
                alert('No worker support :(');
            }*/
        }
        this.mode = mode;
    }.bind(this);

    this.setMode(initMode);

    window.addEventListener('resize', this.onWindowResize.bind(this), false);
};

WebGLPlayer.prototype.onWindowResize = function () {

    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.controls.handleResize();

};

WebGLPlayer.prototype.animate = function () {

    requestAnimationFrame(this.animate.bind(this));
    this.controls.update();

    this.render();
};

/*WebGLPlayer.prototype.frameReceived = function (e) {
    // Call texSubImage2D for thsi delivered frame
    this.videoTexture[this.currentRenderTarget].update(new Uint8Array(e.data.buffer), e.data.x * 512, e.data.y * 512);
    // Mark the current frame as received and processed
    this._currentFrameRequest = this._currentFrameRequest.filter(function (fel) { return !(fel[0] == e.data.x && fel[1] == e.data.y); });
    this.frameCount++;
    // If all requested frames are received, display them, then request a new set
    if (this._currentFrameRequest.length == 0) {
        requestAnimationFrame(this.animate.bind(this));
    }
};

WebGLPlayer.prototype.requestFrames = function (list) {
    this._currentFrameRequest = list;
    for (var l = 0; l < list.length; l++) {
        this.worker.postMessage({
            command: 'giefNewFrame',
            x: list[l][0],
            y: list[l][1],
            black: this.renderBlack
        });
    }
};*/

WebGLPlayer.prototype.render = function () {
    var res = parseInt($('#resolutionDropdown').val());

    /*if (!this._textureInitialized) {
        this.videoTexture.initRender(this.videos[0].element, 512, 512);
        this._textureInitialized = true;
    }*/

    // update video frames
    /*for (var y = 0; y < res; y++) {
        for (var x = 0; x < res; x++) {
            //var frame = this.__getCurrentVideoFrame(this.videos[y * 8 + x]);
            var v = this.videos[y * 8 + x];
            if (v.ready) this.videoTexture.update(v.element, x * 512, y * 512);
        }
    }*/

    var v = this.videos[4 * 8 + 4];
        if (v.ready) this.videoTexture.update(v.element, 0, 0);

    this.renderer.render(this.scene, this.camera); //, this.renderBuffers[this.currentRenderTarget], false
    this.stats.update();

    /*var requestList = [];
    for (var y = 0; y < res; y++) {
        for (var x = 0; x < res; x++) {
            requestList.push([x, y]);
        }
    }
    this.requestFrames(requestList);*/

    //this.renderBlack = !this.renderBlack;

    if (performance.now() - this.frameStart >= 1000) {
        this.frameStart = performance.now();
        this.patchesPerRender = this.frameCount;
        this.frameCount = 0;
    }

    var renderStats = 'Memory:<br /><ul>';
    renderStats += '<li>Geometries: ' + this.renderer.info.memory.geometries + '</li>';
    renderStats += '<li>Textures: ' + this.renderer.info.memory.textures + '</li>';
    renderStats += '</ul>Renderer:<br /><ul>'
    renderStats += '<li>Calls: ' + this.renderer.info.render.calls + '</li>';
    renderStats += '<li>Faces: ' + this.renderer.info.render.faces + '</li>';
    renderStats += '<li>Vertices: ' + this.renderer.info.render.vertices + '</li>';
    renderStats += '<li>Patches per Render: ' + this.patchesPerRender + '</li>'
    renderStats += '</ul>';
    $('#renderStats').html(renderStats);
};

WebGLPlayer.prototype.__getCurrentVideoFrame = function (video) {
    // https://stackoverflow.com/questions/28420724/how-to-determine-the-intended-frame-rate-on-an-html-video-element/28455790#28455790
    // The following is very inefficient, stupid, and has many artifacts...
    this.videoDrawContext.drawImage(video, 0, 0);
    var rgba = this.videoDrawContext.getImageData(0, 0, 512, 512).data;
    var l = rgba.length / 4;
    var grayscale = new Uint8Array(l);
    for (var i = 0; i < l; i++) {
        grayscale[i] = rgba[i * 4];
    }
    return grayscale;
};