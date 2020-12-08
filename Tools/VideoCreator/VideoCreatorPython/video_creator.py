from datetime import datetime

from utils.vdloader import VDLoader
from utils.vcreator import VCreator
import pathlib
import os

if __name__ == "__main__":
    vdloader = VDLoader(datetime(2017, 9, 6, 8, 0, 0), datetime(2017, 9, 6, 10, 0, 0))
    if vdloader.dl_videos():
    #     vcreator = VCreator()
    #     vcreator.create_video()
        vcreator = VCreator(output_dir='{}movies/4k/mp4'.format(os.path.dirname(__file__)), video_sizes=[4096], fps=25, video_time_span_seconds=2)
        vcreator.create_video()