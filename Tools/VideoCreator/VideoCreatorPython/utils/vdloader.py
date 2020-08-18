from PIL import Image
import requests
import shutil
import re
import os
import sys
import json
from tqdm import tqdm
import datetime
from datetime import datetime
from datetime import timedelta

class VDLoader:
    def __init__(self, start, end, origin='https://api.helioviewer.org/v2/', destination=os.path.dirname(os.path.dirname(__file__))+'/images/'):
        self.origin = origin
        self.destination = destination
        self.start = start
        self.end = end

    def dl_videos(self):
        delta = timedelta(seconds = 12)
        current = self.start
        pre_date = ''

        if os.path.exists(self.destination):
            shutil.rmtree(self.destination)
        os.makedirs(self.destination)       

        pbar = tqdm(total=self.estimate_no_images(delta))
        while self.end > current:
            payload = {'date': current.isoformat() + "Z", 'sourceId':'10'}
            r = requests.get(self.origin +'getClosestImage/', payload)
            curr_date = json.loads(r.content)['date']
            
            if curr_date != pre_date:
                pre_date = curr_date
                r = requests.get(self.origin +'getJP2Image/', payload, stream=True)
                if r.status_code == 200:
                    d = r.headers['content-disposition']
                    fnames = re.findall("filename=(.+)", d)
                    base = os.path.splitext(self.destination + fnames[0].strip("'").strip("\""))[0]
                    with open(base + ".jp2", 'wb') as out_file:
                        shutil.copyfileobj(r.raw, out_file)

                    img = Image.open(base + ".jp2")
                    img.save(base + ".bmp", "BMP")
                    #img.save(base + ".jpg", "JPEG")
                    del img
                    os.remove(base + ".jp2")
                del r
    
            current = current + delta
            pbar.update(1)
        pbar.close()

        #todo: add check for download
        return True

    #todo: find a more accurate solution
    def estimate_no_images(self, delta):
        counter = 0
        current = self.start
        while self.end > current:
            counter += 1
            current = current + delta
        return counter


