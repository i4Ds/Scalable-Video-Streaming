// first we initialize the texture with some empty data
function UpdatableVideoTexture(format, type, mapping, wrapS, wrapT, magFilter, minFilter, anisotropy) { //, encoding

    // TODO: GL_RED? Video transformation? No gl_get rebinding?

    //THREE.Texture.call(this, new Uint8Array(4), 2, 2, format, type);
    THREE.Texture.call(this, null, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy); //, encoding
    //this.format = format;
    //this.type = type;

    var canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    var ctx = canvas.getContext('2d');
    var imageData = ctx.createImageData(1, 1);
    this.image = imageData;

    //this.image = { data: new Uint8Array(4), width: 2, height: 2};

    this.magFilter = magFilter !== undefined ? magFilter : THREE.LinearFilter;
    this.minFilter = minFilter !== undefined ? minFilter : THREE.LinearFilter;

    this.generateMipmaps = false;
    this.flipY = false;
    this.unpackAlignment = 1;
    this.needsUpdate = true;
    this.premultiplyAlpha = false;
}

UpdatableVideoTexture.prototype = Object.create(THREE.Texture.prototype );
UpdatableVideoTexture.prototype.constructor = UpdatableVideoTexture;

UpdatableVideoTexture.prototype.isUpdatableTexture = true;

UpdatableVideoTexture.prototype.setRenderer = function( renderer ) {
	this.renderer = renderer;
    this.gl = this.renderer.getContext();
    this.utils = THREE.WebGLUtils(this.gl, this.renderer.extensions);
}

UpdatableVideoTexture.prototype.initRender = function () {
    var width = 4096;
    var height = 4096;

    //if (width === this.width && height === this.height) return;

	var textureProperties = this.renderer.properties.get( this );
    if (!textureProperties.__webglTexture) return;

    this.width = width;
    this.height = height;

	var activeTexture = this.gl.getParameter( this.gl.TEXTURE_BINDING_2D );
	this.gl.bindTexture( this.gl.TEXTURE_2D, textureProperties.__webglTexture );
    if (!textureProperties.__webglTexture) this.width = null;

    this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);

    this._webglformat = this.utils.convert(this.format)

    this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this._webglformat,
        width,
        height,
        0,
        this._webglformat,
        this.utils.convert(this.type),
        new Uint8Array(width * height)
    );

    console.log('texImage2D');

	this.gl.bindTexture( this.gl.TEXTURE_2D, activeTexture );

}

// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Animating_textures_in_WebGL
UpdatableVideoTexture.prototype.update = function (video, x, y) {

    //this.isDataTexture = false;
    //this.isVideoTexture = true;

    var textureProperties = this.renderer.properties.get(this);
    //console.log(textureProperties.__webglTexture);
	if( !textureProperties.__webglTexture ) return;

    var activeTexture = this.gl.getParameter(this.gl.TEXTURE_BINDING_2D);
    this.gl.bindTexture(this.gl.TEXTURE_2D, textureProperties.__webglTexture);

    if (video == undefined || video == null) console.log('NULL');
    
    var len = 512; //Math.round(Math.sqrt(src.length));
	this.gl.texSubImage2D(
		this.gl.TEXTURE_2D,
		0,
		x,
        y,
        this._webglformat,
		this.utils.convert( this.type ),
        video
    );
    //console.log('texSubImage2D');

	//this.gl.generateMipmap( this.gl.TEXTURE_2D );
	this.gl.bindTexture( this.gl.TEXTURE_2D, activeTexture );

}
