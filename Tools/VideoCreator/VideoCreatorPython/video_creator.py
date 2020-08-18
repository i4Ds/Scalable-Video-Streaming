from datetime import datetime

from utils.vdloader import VDLoader
from utils.vcreator import VCreator
import pathlib

if __name__ == "__main__":
    vdloader = VDLoader(datetime(2017, 9, 6, 8, 0, 0), datetime(2017, 9, 6, 16, 0, 0))
    if vdloader.dl_videos():
        vcreator = VCreator()
        vcreator.create_video()