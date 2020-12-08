video_index = [0,1,2,3];
curr_video_index = 1;

var video = document.getElementById('video');
var source = document.createElement('source');
source.setAttribute('src', './movies/0/t1_0-0.mp4');
video.appendChild(source);
video.play();


function get_next_video(params) {
    url = './movies/' + curr_video_index + '/t1_0-0.mp4';
    console.log(url);
    source.setAttribute('src', url);
    video.appendChild(source);
    curr_video_index++;
    if(curr_video_index == video_index.length) {
        curr_video_index = 0;
    }

    return video;
}


video.addEventListener('started',function(){
    console.log("video started");
    video = get_next_video();
});

video.addEventListener('ended',function(){
    console.log("video ended");

    video = get_next_video();
    video.play();
});

// video.addEventListener("canplaythrough", function() {

//   }, false);