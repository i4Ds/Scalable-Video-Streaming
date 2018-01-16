onmessage = function (e) {
    //setInterval(updateBuffer, 33);
    if (e.data.command == 'giefNewFrame') {
        updateBuffer(e.data.y, e.data.x);
    }
}

updateBuffer = function (y, x) {
    var buffer = new Uint8Array(512 * 512);

    //var v = videos[y * 8 + x];
    /*for (var by = y * 512; by < (y + 1) * 512; by++) {
        var byoffset = by * 4096;
        for (var bx = x * 512; bx < (x + 1) * 512; bx++) {
            buffer[byoffset + bx] = 255;//Math.floor(Math.random() * 256);//255;
        }
    }*/
    for (var py = 0; py < 512; py++) {
        var yoffset = py * 512;
        for (var px = 0; px < 512; px++) {
            buffer[yoffset + px] = 255;
        }
    }
    postMessage({
        x: x,
        y: y,
        buffer: buffer.buffer
    }, [buffer.buffer]);
};