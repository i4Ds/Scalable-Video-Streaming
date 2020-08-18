import ffmpeg
import os
from datetime import datetime
import shutil
from tqdm import tqdm
import math
import sys

class VCreator():
    def __init__(self, input_dir=os.path.dirname(os.path.dirname(__file__))+'/images/', output_dir=os.path.dirname(os.path.dirname(__file__))+'/movies/mp4', symlink_dir=os.path.dirname(os.path.dirname(__file__))+'/.symlink_videos/', video_sizes=[4096, 2048, 1024, 512], fps=25, video_time_span_seconds=2, image_data_type='.bmp', video_data_type='.mp4'):
        self.input_dir = input_dir
        self.output_dir = output_dir
        self.symlink_dir = symlink_dir
        self.video_sizes = video_sizes
        self.fps = fps
        self.video_time_span_seconds = video_time_span_seconds
        self.image_data_type = image_data_type
        self.video_data_type = video_data_type
        self.current_vid = 0
        self.image_files = self.get_files_in_input_dir()

    def get_files_in_input_dir(self):
        files_list = []
        for root,dirs,files in os.walk(self.input_dir):
            for names in files:
                if names.endswith(self.image_data_type):
                    files_list.append(os.path.join(root, names))
        return sorted(files_list)

    def create_video(self):
        self.get_images_for_next_video_snippet()

        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
        
        if not os.path.exists('{}/{}'.format(self.output_dir, self.current_vid)):
            os.makedirs('{}/{}'.format(self.output_dir, self.current_vid))

        print('Parsing videos --> vid:', self.current_vid)

        pbar = tqdm(total=sum([int(pow(4096/size, 2)) for size in self.video_sizes]))
        for size in self.video_sizes:
            for x in range(int(4096/size)):
                for y in range(int(4096/size)):
                    (
                    ffmpeg
                    .input(self.symlink_dir+'*{}'.format(self.image_data_type), pattern_type='glob', framerate=self.fps)
                    .crop(size*x, size*y, size, size)
                    .filter('scale', size='512:512')
                    .output(self.output_dir+'/{}/t{}_{}-{}{}'.format(self.current_vid, int(pow(4096/size, 2)), y, x, self.video_data_type), vcodec='libx264', **{'profile:v': 'baseline', 'level': '3.0', 'threads': '0', 'crf': '20', 'pix_fmt': 'yuv420p', 'loglevel': 'quiet'}) # https://gist.github.com/jaydenseric/220c785d6289bcfd7366
                    .run()
                    )
                    pbar.update(1)
        pbar.close()
        self.current_vid = self.current_vid + 1
        self.create_video()

    def get_images_for_next_video_snippet(self):
        number_of_frames = self.video_time_span_seconds*self.fps
        current_images = self.image_files[(self.current_vid)*number_of_frames:(self.current_vid+1)*number_of_frames]
        if len(current_images) == 0:
            sys.exit('No more images available')
        self.symlink_files(current_images)

    def symlink_files(self, path_list):
        if os.path.exists(self.symlink_dir):
            shutil.rmtree(self.symlink_dir)
        os.makedirs(self.symlink_dir)

        for file in path_list:
            os.symlink(file, self.symlink_dir+file.split('/')[-1])