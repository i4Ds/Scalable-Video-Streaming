onmessage = function (e) {
    //setInterval(updateBuffer, 33);
    if (e.data.command == 'giefNewFrame') {
        updateBuffer(e.data.y, e.data.x, e.data.black);
    }
}

updateBuffer = function (y, x, renderBlack) {
    var size = 512;
    var buffer = new Uint8Array(size * size);

    //var v = videos[y * 8 + x];
    /*for (var by = y * 512; by < (y + 1) * 512; by++) {
        var byoffset = by * 4096;
        for (var bx = x * 512; bx < (x + 1) * 512; bx++) {
            buffer[byoffset + bx] = 255;//Math.floor(Math.random() * 256);//255;
        }
    }*/
    var col = renderBlack ? 0 : 255 - 3 * (y * 8 + x);
    for (var py = 0; py < size; py++) {
        var yoffset = py * size;
        for (var px = 0; px < size; px++) {
            buffer[yoffset + px] = col;
        }
    }
    postMessage({
        x: x,
        y: y,
        buffer: buffer.buffer
    }, [buffer.buffer]);
};