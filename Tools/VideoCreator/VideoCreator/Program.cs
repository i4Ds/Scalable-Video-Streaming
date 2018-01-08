﻿using System;
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
using System.Globalization;

namespace VideoCreator
{
    class Program
    {
        private static readonly int[] SIZES = new[]{ 512, 1024, 2048, 4096 };
        private const string DATE_FORMAT = "yyyy_MM_dd__HH_mm_ss_FF";
        private const string IN_DIR = @"C:\Users\Roman Bolzern\Documents\GitHub\Scalable-Video-Streaming\Data\bmp";
        private const string OUT_DIR  = @"C:\Users\Roman Bolzern\Documents\GitHub\Scalable-Video-Streaming\Data\video512";

        const int MOVIE_LENGTH = 64;
        const int MOVIE_WIDTH = 512;

        static void Main(string[] args)
        {

            Stopwatch resizeTimer = Stopwatch.StartNew();
            //ResizeImages(IN_DIR);
            resizeTimer.Stop();
            
            Stopwatch videoTimer = Stopwatch.StartNew();
            CreateVideoTree(IN_DIR, OUT_DIR);
            videoTimer.Stop();

            Console.WriteLine($"Resize: {resizeTimer.Elapsed}");
            Console.WriteLine($"Video:  {videoTimer.Elapsed}");

            Console.ReadLine();
        }

        static void CreateVideoTree(string inDirectory, string outDirectory)
        {
            if (!Directory.Exists(inDirectory))
            {
                throw new ArgumentException();
            }
            if (!Directory.Exists(outDirectory))
            {
                Directory.CreateDirectory(outDirectory);
            }

            int nrFiles = Directory.EnumerateFiles(inDirectory).Count();
            //int curSize = 128; // 4 * 1024;

            Bitmap[] movieFrames = new Bitmap[MOVIE_LENGTH];
            DateTime startTime = DateTime.Now;

            var bmpFiles = Directory.EnumerateFiles(inDirectory).ToArray();

            // RIP complexity
            foreach (int curSize in SIZES)
            {
                int curOffset = 1;
                string curDir = Path.Combine(inDirectory, curSize.ToString());
                while (curOffset * MOVIE_LENGTH <= nrFiles)
                {
                    int frameIndex = 0;
                    int fileIndex = 0;
                    try
                    {
                        foreach (string file in bmpFiles)
                        {
                            if (fileIndex % curOffset == 0)
                            {
                                string fileName = Path.GetFileNameWithoutExtension(file);
                                if (frameIndex == 0)
                                {
                                    startTime = DateTime.ParseExact(fileName.Substring(0, DATE_FORMAT.Length), DATE_FORMAT, CultureInfo.InvariantCulture);
                                }
                                movieFrames[frameIndex] = Accord.Imaging.Image.FromFile(curSize == 4096 ? file : Path.Combine(curDir, $"{fileName}_{curSize}.bmp"));
                                frameIndex++;

                                if (frameIndex >= MOVIE_LENGTH)
                                {
                                    CreateMovies(movieFrames, curSize, outDirectory, curOffset, startTime);
                                    frameIndex = 0;

                                    for (int i = 0; i < movieFrames.Length; i++)
                                    {
                                        movieFrames[i]?.Dispose();
                                        movieFrames[i] = null;
                                    }
                                }
                            }

                            fileIndex++;
                        }

                        curOffset *= 2;
                    }
                    catch(Exception e)
                    {
                        Console.WriteLine(e.Message);
                    }
                    finally
                    {
                        if (frameIndex != 0)
                        {
                            for (int i = 0; i < movieFrames.Length; i++)
                            {
                                movieFrames[i]?.Dispose();
                                movieFrames[i] = null;
                            }
                        }
                    }
                }
            }
        }

        private static void CreateMovies(Bitmap[] movieFrames, int resolution, string outDirectory, int offset, DateTime startTime)
        {
            string outDir = Path.Combine(outDirectory,
                resolution.ToString(),
                offset.ToString(),

                startTime.Year.ToString(), 
                startTime.Month.ToString(), 
                startTime.Day.ToString(), 
                startTime.Hour.ToString(),
                startTime.Minute.ToString(),
                startTime.Second.ToString(),

                "SDO_AIA_171");
            if(!Directory.Exists(outDir))
            {
                Directory.CreateDirectory(outDir);
            }

            int slizes = resolution / MOVIE_WIDTH;

            for(int x = 0; x < slizes; x++)
            {
                for(int y = 0; y < slizes; y++)
                {
                    // ToDo: DAte info also as folder Hierarchy?
                    using (VideoFileWriter video = new VideoFileWriter())
                    {
                        video.Open(Path.Combine(outDir, $"{startTime.ToString("FF")}__{x}_{y}.mp4"), MOVIE_WIDTH, MOVIE_WIDTH, 32, VideoCodec.H264, 1024 * 1024, AudioCodec.None, 0, 0, 0);
                        Rectangle region = new Rectangle(x * MOVIE_WIDTH, y * MOVIE_WIDTH, MOVIE_WIDTH, MOVIE_WIDTH);

                        for (int i = 0; i < movieFrames.Length; i++)
                        {
                            using (Bitmap frame = movieFrames[i].Clone(region, movieFrames[i].PixelFormat))
                            {
                                video.WriteVideoFrame(frame);
                            }
                        }

                        video.Flush();
                    }
                }
            }
        }

        static void ResizeImages(string directory)
        {
            if(!Directory.Exists(directory))
            {
                throw new ArgumentException();
            }

            foreach(int size in SIZES)
            {
                string dir = Path.Combine(directory, size.ToString());
                if(!Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }
            }

            int counter = 0;
            foreach(var file in Directory.EnumerateFiles(directory))
            {
                if (!String.Equals(".bmp", Path.GetExtension(file), StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                
                string filename = Path.GetFileNameWithoutExtension(file);

                foreach(int size in SIZES)
                {
                    string smallDirectory = Path.Combine(directory, size.ToString());
                    string smallFileName = Path.Combine(smallDirectory, $"{filename}_{size}.bmp");

                    if (!File.Exists(smallFileName))
                    {
                        using (var image = new ImageMagick.MagickImage(file))
                        {
                            if(image.Width != size)
                            {
                                image.Resize(size, size);

                                image.ColorType = ImageMagick.ColorType.Grayscale;
                                image.ColorSpace = ImageMagick.ColorSpace.Gray;
                                image.Depth = 8;

                                image.Write(smallFileName);
                            }
                            //else
                            //{
                            //    File.Copy(file, smallFileName);
                            //}
                        }
                    }
                }
                counter++;

                if(counter % 64 == 0)
                {
                    Console.WriteLine(counter);
                }
            }
        }

        /*
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

        */

        static void Test()
        {
            string smallDirectory = Path.Combine(IN_DIR, "small");
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

            foreach (var file in Directory.EnumerateFiles(IN_DIR))
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
    }
}
