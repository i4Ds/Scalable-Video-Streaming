function UpdatableDataTexture(data, width, height, format, type, mapping, wrapS, wrapT, magFilter, minFilter, anisotropy, encoding) {

    THREE.Texture.call(this, null, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, encoding);

    this.image = { data: data, width: width, height: height };

    this.height = height;
    this.width = width;

    this.magFilter = magFilter !== undefined ? magFilter : THREE.NearestFilter;
    this.minFilter = minFilter !== undefined ? minFilter : THREE.NearestFilter;

    this.generateMipmaps = false;
    this.flipY = false;
    this.unpackAlignment = 1;
    this.needsUpdate = true;

}

UpdatableDataTexture.prototype = Object.create( THREE.Texture.prototype );
THREE.DataTexture.prototype.constructor = UpdatableDataTexture;

UpdatableDataTexture.prototype.isUpdatableTexture = true;
UpdatableDataTexture.prototype.isDataTexture = true;

UpdatableDataTexture.prototype.setRenderer = function( renderer ) {

	this.renderer = renderer;
	this.gl = this.renderer.getContext()
	this.utils = THREE.WebGLUtils(this.gl, this.renderer.extensions)

}

UpdatableDataTexture.prototype.setSize = function( data, width, height ) {

	if( width === this.width && height === this.height ) return;

	var textureProperties = this.renderer.properties.get( this );
	if( !textureProperties.__webglTexture ) return;

	this.width = width;
    this.height = height;

	var activeTexture = this.gl.getParameter( this.gl.TEXTURE_BINDING_2D );
	this.gl.bindTexture( this.gl.TEXTURE_2D, textureProperties.__webglTexture );
	if( !textureProperties.__webglTexture ) this.width = null;
	this.gl.texImage2D(
		this.gl.TEXTURE_2D,
		0,
		this.utils.convert( this.format ),
		width,
		height,
		0,
		this.utils.convert( this.format ),
		this.utils.convert( this.type ),
		data
	);
	this.gl.bindTexture( this.gl.TEXTURE_2D, activeTexture );

}

UpdatableDataTexture.prototype.update = function( src, x, y ) {

	var textureProperties = this.renderer.properties.get( this );
	if( !textureProperties.__webglTexture ) return;

    var activeTexture = this.gl.getParameter(this.gl.TEXTURE_BINDING_2D);
    /*this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);*/
    this.gl.bindTexture(this.gl.TEXTURE_2D, textureProperties.__webglTexture);
    
    var len = Math.round(Math.sqrt(src.length));
	this.gl.texSubImage2D(
		this.gl.TEXTURE_2D,
		0,
		x,
        this.height - y - len,
        len,
        len,
		this.utils.convert( this.format ),
		this.utils.convert( this.type ),
        src
	);
	//this.gl.generateMipmap( this.gl.TEXTURE_2D );
	this.gl.bindTexture( this.gl.TEXTURE_2D, activeTexture );

}
