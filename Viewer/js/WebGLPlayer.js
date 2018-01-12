var WebGLPlayer = function (videos, initMode) {
    if (!Detector.webgl) Detector.addGetWebGLMessage();

    this.stats = new Stats();
    this.stats.showPanel(1);
    document.body.appendChild(this.stats.dom);
    $(this.stats.dom).css('left', '300px');

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
    this.camera.position.z = 500;

    this.container = document.getElementById('container');

    this.controls = new THREE.TrackballControls(this.camera, this.container);

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
    this.scene.background = new THREE.Color(0xcccccc);
    //scene.fog = new THREE.FogExp2(0xcccccc, 0.002);

    this.setMode = function (mode) {
        console.log('Switching to ' + mode);
        // clear stuff
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
            var canvas = $('<canvas id="videoCanvas" height="4096" width="4096"></canvas>');
            canvas.css({
                'position': 'absolute',
                'left': -1000,
                'top': -500,
                'z-index': 5000,
                'display': 'none'
            });
            $(document.body).append(canvas);
            this.videoContext = canvas[0].getContext('2d');

            var geometry = new THREE.SphereGeometry(100, 32, 32);
            this.videoTexture = new THREE.Texture(canvas[0]);
            var vt = this.videoTexture;
            var material = new THREE.MeshPhongMaterial({ color: 0xffffff, map: vt, flatShading: false });
            var mesh = new THREE.Mesh(geometry, material);
            mesh.updateMatrix();
            mesh.matrixAutoUpdate = false;
            this.scene.add(mesh);
            this.__sphereMesh = mesh;
            this.__sphereMat = material;
            this.__sphereGeom = geometry;
        }
        this.mode = mode;
    }.bind(this);


    this.setMode(initMode);


    var light = new THREE.AmbientLight(0x888888);
    this.scene.add(light);


    // renderer

    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.container.appendChild(this.renderer.domElement);

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

    if (this.mode == '1bigTexture') {
        for (var i = 0; i < 64; i++) {
            var x = i % 8;
            var y = (i - x) / 8;
            this.videoContext.drawImage(this.videos[i], x * 512, y * 512, 512, 512);
        }
        this.videoTexture.needsUpdate = true;
    }

    this.render();
};

WebGLPlayer.prototype.render = function () {
    this.renderer.render(this.scene, this.camera);
    this.stats.update();
    var renderStats = 'Memory:<br /><ul>';
    renderStats += '<li>Geometries: ' + this.renderer.info.memory.geometries + '</li>';
    renderStats += '<li>Textures: ' + this.renderer.info.memory.textures + '</li>';
    renderStats += '</ul>Renderer:<br /><ul>'
    renderStats += '<li>Calls: ' + this.renderer.info.render.calls + '</li>';
    renderStats += '<li>Faces: ' + this.renderer.info.render.faces + '</li>';
    renderStats += '<li>Vertices: ' + this.renderer.info.render.vertices + '</li>';
    renderStats += '</ul>';
    $('#renderStats').html(renderStats);
};