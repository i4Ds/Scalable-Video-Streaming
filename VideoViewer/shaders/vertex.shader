#version 300 es

attribute vec4 vPosition;
attribute vec2 vTexCoord;

varying vec2 texCoord;

void main(void)
{
    gl_Position = vPosition;
    texCoord = vTexCoord;
}