// Created by Bjorn Sandvik - thematicmapping.org
(function () {

	var webglEl = document.getElementById('webgl');

	if (!Detector.webgl) {
		Detector.addGetWebGLMessage(webglEl);
		return;
	}

	var width  = window.innerWidth,
		height = window.innerHeight;

	// Earth params
	var radius   = 0.5,
		segments = 32,
		rotation = 6;  

	var scene = new THREE.Scene();

	var camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
	camera.position.z = 1.5;

	var renderer = new THREE.WebGLRenderer();
	renderer.setSize(width, height);

	scene.add(new THREE.AmbientLight(0xffffff));

	// var light = new THREE.DirectionalLight(0xffffff, 1);
	// light.position.set(5,3,5);
	// scene.add(light);

    var sphere = createSphere(radius, segments);
	sphere.rotation.y = rotation; 
	scene.add(sphere)

    // var clouds = createClouds(radius, segments);
	// clouds.rotation.y = rotation;
	// scene.add(clouds)

	var stars = createStars(90, 64);
	scene.add(stars);

	var controls = new THREE.TrackballControls(camera);

	webglEl.appendChild(renderer.domElement);

	render();

	function render() {
		controls.update();
		sphere.rotation.y += 0.0005;
		// clouds.rotation.y += 0.0005;		
		requestAnimationFrame(render);
		renderer.render(scene, camera);
	}

	function createSphere(radius, segments) {
		// var video = document.getElementById( 'video' );
		// video.play();
		
		var sphere = new THREE.SphereGeometry(radius, segments, segments);

		// modify UVs to accommodate MatCap texture
		var faceVertexUvs = sphere.faceVertexUvs[0];
		console.log(faceVertexUvs.length);
		for ( i = 0; i < faceVertexUvs.length; i ++ ) {

		var uvs = faceVertexUvs[ i ];
		var face = sphere.faces[ i ];

		if (i == 0) {
			console.log(uvs);
			console.log(face);	
		}

		for ( var j = 0; j < 3; j ++ ) {
			uvs[ j ].x = face.vertexNormals[ j ].x * 0.4 + 0.5;
			uvs[ j ].y = face.vertexNormals[ j ].y * 0.4 + 0.5;
		}

	}
			
		var mesh = new THREE.MeshPhongMaterial({
				// map:         new THREE.TextureLoader().load('images/sun.png'),
				map:         new THREE.VideoTexture( video = video),
				// bumpMap:     THREE.ImageUtils.loadTexture('images/white_dot.png'),
				// bumpScale:   1,
				// specularMap: THREE.ImageUtils.loadTexture('images/black.png'),
				// specular:    new THREE.Color('grey'),
				//mapping: THREE.EquirectangularRefractionMapping,
				//alphaMap: new THREE.TextureLoader().load('images/black_dot.png'),
				// envMap: THREE.ImageUtils.loadTexture('images/black.png'),
				//displacementMap: THREE.ImageUtils.loadTexture('images/black_dot.png'),
			});
		
		return new THREE.Mesh(sphere, mesh);
	}

	function createStars(radius, segments) {
		return new THREE.Mesh(
			new THREE.SphereGeometry(radius, segments, segments), 
			new THREE.MeshBasicMaterial({
				map:  new THREE.TextureLoader().load('images/galaxy_starfield.png'), 
				side: THREE.BackSide
			})
		);
	}

}());