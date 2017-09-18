using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using Accord.Video.FFMPEG;
using System.IO;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Diagnostics;

namespace VideoCreator
{
    class Program
    {
        const string dataDirectory = @"D:\Data\Scalable-Video-Streaming\2h set\bmp";

        static void Main(string[] args)
        {

            Stopwatch timer = Stopwatch.StartNew();
            ResizeImages(dataDirectory);
            timer.Stop();

            Console.WriteLine($"All Images resized: {timer.Elapsed}");
            Console.ReadLine();
        }

        static void ResizeImages(string directory)
        {
            if(!Directory.Exists(directory))
            {
                throw new ArgumentException();
            }

            int[] sizes = new[] {128, 256, 512, 1024, 2048 };

            foreach(int size in sizes)
            {
                string dir = Path.Combine(directory, size.ToString());
                if(!Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }
            }

            foreach(var file in Directory.EnumerateFiles(directory))
            {
                if (!String.Equals(".bmp", Path.GetExtension(file), StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                
                string filename = Path.GetFileNameWithoutExtension(file);

                foreach(int size in sizes)
                {
                    string smallDirectory = Path.Combine(directory, size.ToString());
                    string smallFileName = Path.Combine(smallDirectory, $"{filename}_{size}.bmp");

                    if (!File.Exists(smallFileName))
                    {
                        using (var image = new ImageMagick.MagickImage(file))
                        {
                            image.Resize(size, size);
                            using (Bitmap smallImage = image.ToBitmap(ImageFormat.Bmp))
                            {
                                smallImage.Save(smallFileName, ImageFormat.Bmp);
                            }
                        }
                    }
                }
            }
        }

        static void Test()
        {
            string smallDirectory = Path.Combine(dataDirectory, "small");
            if (!Directory.Exists(smallDirectory))
            {
                Directory.CreateDirectory(smallDirectory);
            }

            VideoFileWriter video = new VideoFileWriter();
            //video.Open("test.mp4", 4 * 1024, 4 * 1024, 30, VideoCodec.MPEG4);
            //video.Open("test2.mp4", 4 * 1024, 4 * 1024, 30, VideoCodec.H264, 1 * 1024 * 1024);
            video.Open("test4.mp4", 128, 128, 30, VideoCodec.H264, 1024 * 1024);

            Stopwatch elapsedTime = Stopwatch.StartNew();

            int frames = 0;

            foreach (var file in Directory.EnumerateFiles(dataDirectory))
            {
                if (!String.Equals(".bmp", Path.GetExtension(file), StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                string filename = Path.GetFileNameWithoutExtension(file);
                string smallFileName = Path.Combine(smallDirectory, filename + "_small.bmp");

                if (!File.Exists(smallFileName))
                {
                    var test = new ImageMagick.MagickImage(file);

                    using (Bitmap frame = Image.FromFile(file) as Bitmap)
                    {
                        test.Resize(128, 128);

                        //Bitmap small = ResizeImage(frame, 1024, 1024);

                        //Bitmap small = frame.Clone(new Rectangle(512, 1964, 1024, 1024), PixelFormat.Format8bppIndexed);

                        //Bitmap small = new Bitmap(frame, 1024, 1024);
                        Bitmap small = test.ToBitmap(ImageFormat.Bmp);
                        small.Save(smallFileName, ImageFormat.Bmp);
                        video.WriteVideoFrame(small);
                    }
                }
                else
                {
                    Bitmap small = Image.FromFile(smallFileName) as Bitmap;
                    video.WriteVideoFrame(small);
                }

                //Bitmap frame = Image.FromFile(file) as Bitmap;
                //video.WriteVideoFrame(frame);

                frames++;
            }

            video.Flush();
            video.Close();

            elapsedTime.Stop();

            Console.WriteLine($"Created Video in {elapsedTime.Elapsed} seconds");
            Console.ReadLine();
        }

        /// <summary>
        /// Resize the image to the specified width and height.
        /// </summary>
        /// <param name="image">The image to resize.</param>
        /// <param name="width">The width to resize to.</param>
        /// <param name="height">The height to resize to.</param>
        /// <returns>The resized image.</returns>
        public static Bitmap ResizeImage(Bitmap image, int width, int height)
        {
            // taken from https://stackoverflow.com/questions/1922040/resize-an-image-c-sharp/24199315#24199315
            var destRect = new Rectangle(0, 0, width, height);
            var destImage = new Bitmap(width, height);

            destImage.SetResolution(image.HorizontalResolution, image.VerticalResolution);

            using (var graphics = Graphics.FromImage(destImage))
            {
                graphics.CompositingMode = CompositingMode.SourceCopy;
                graphics.CompositingQuality = CompositingQuality.HighQuality;
                graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                graphics.SmoothingMode = SmoothingMode.HighQuality;
                graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;

                using (var wrapMode = new ImageAttributes())
                {
                    wrapMode.SetWrapMode(WrapMode.TileFlipXY);
                    graphics.DrawImage(image, destRect, 0, 0, image.Width, image.Height, GraphicsUnit.Pixel, wrapMode);
                }
            }

            return destImage;
        }
    }
}
