// first we initialize the texture with some empty data
function UpdatableVideoTexture(format, type, mapping, wrapS, wrapT, magFilter, minFilter, anisotropy) { //, encoding

    THREE.Texture.call(this, null, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy); //, encoding

    var canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    var ctx = canvas.getContext('2d');
    var imageData = ctx.createImageData(1, 1);

    this.image = imageData;

    this.magFilter = magFilter !== undefined ? magFilter : THREE.NearestFilter;
    this.minFilter = minFilter !== undefined ? minFilter : THREE.NearestFilter;

    this.generateMipmaps = false;
    this.flipY = false;
    this.unpackAlignment = 1;
    this.needsUpdate = true;
    this.premultiplyAlpha = false;
}

UpdatableVideoTexture.prototype = Object.create( THREE.Texture.prototype );
UpdatableVideoTexture.prototype.constructor = UpdatableVideoTexture;

UpdatableVideoTexture.prototype.isUpdatableTexture = true;

UpdatableVideoTexture.prototype.setRenderer = function( renderer ) {
	this.renderer = renderer;
    this.gl = this.renderer.getContext();
    this.utils = THREE.WebGLUtils(this.gl, this.renderer.extensions);
}

UpdatableVideoTexture.prototype.initRender = function (video, width, height) {

    console.log(this.width, this.height);

    if (width === this.width && height === this.height) return;

	var textureProperties = this.renderer.properties.get( this );
    if (!textureProperties.__webglTexture) return;

    this.width = width;
    this.height = height;

	var activeTexture = this.gl.getParameter( this.gl.TEXTURE_BINDING_2D );
	this.gl.bindTexture( this.gl.TEXTURE_2D, textureProperties.__webglTexture );
    if (!textureProperties.__webglTexture) this.width = null;

	/*this.gl.texImage2D(
		this.gl.TEXTURE_2D,
		0,
		this.utils.convert( this.format ),
		this.width,
		this.height,
		0,
		this.utils.convert( this.format ),
		this.utils.convert( this.type ),
        new Uint8Array(width * height)
	);*/

    this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.utils.convert(this.format),
        this.utils.convert(this.format),
        this.utils.convert(this.type),
        video
    );
    console.log('texImage2D');

	this.gl.bindTexture( this.gl.TEXTURE_2D, activeTexture );

}

// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Animating_textures_in_WebGL
UpdatableVideoTexture.prototype.update = function( video, x, y ) {

    //this.isDataTexture = false;
    //this.isVideoTexture = true;

    // maybe necessary for video type:
    /*const internalFormat = gl.RGBA;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;*/

	var textureProperties = this.renderer.properties.get( this );
	if( !textureProperties.__webglTexture ) return;

    var activeTexture = this.gl.getParameter(this.gl.TEXTURE_BINDING_2D);
    /*this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);*/
    this.gl.bindTexture(this.gl.TEXTURE_2D, textureProperties.__webglTexture);
    
    var len = 512; //Math.round(Math.sqrt(src.length));
	/*this.gl.texSubImage2D(
		this.gl.TEXTURE_2D,
		0,
		x,
        this.height - y - len,
        this.utils.convert( this.format ),
		this.utils.convert( this.type ),
        video
	);
    this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.utils.convert(this.format),
        this.utils.convert(this.format),
        this.utils.convert(this.type),
        video
    );*/
    this.gl.texSubImage2D(
        this.gl.TEXTURE_2D,
        0,
        0,
        0,
        this.utils.convert(this.format),
        this.utils.convert(this.type),
        video
    );
	//this.gl.generateMipmap( this.gl.TEXTURE_2D );
	this.gl.bindTexture( this.gl.TEXTURE_2D, activeTexture );

}
