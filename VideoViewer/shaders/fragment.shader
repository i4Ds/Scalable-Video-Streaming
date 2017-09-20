#version 300 es

varying vec2 texCoord;
uniform sampler2D segmentTexture;

void main(void)
{
    gl_FragColor = texture2D(segmentTexture, texCoord);
}