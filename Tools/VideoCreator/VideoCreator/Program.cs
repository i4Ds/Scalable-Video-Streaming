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
using System.Globalization;
using System.Runtime.InteropServices;

namespace VideoCreator
{
    class Program
    {
        private static readonly int[] SIZES = new[] { 512, 1024, 2048, 4096 };
        private const string DATE_FORMAT = "yyyy_MM_dd__HH_mm_ss_FF";
        private const string IN_DIR = @"C:\Users\Roman Bolzern\Documents\GitHub\Scalable-Video-Streaming\Data\bmp";
        private const string OUT_DIR = @"C:\Users\Roman Bolzern\Documents\GitHub\Scalable-Video-Streaming\Data\video512";

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
                                var fname = curSize == 4096 ? file : Path.Combine(curDir, $"{fileName}_{curSize}.bmp");
                                //movieFrames[frameIndex] = Accord.Imaging.Image.FromFile(fname);
                                movieFrames[frameIndex] = new Bitmap(fname);
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
                    catch (Exception e)
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
            if (!Directory.Exists(outDir))
            {
                Directory.CreateDirectory(outDir);
            }

            int slizes = resolution / MOVIE_WIDTH;

            for (int x = 0; x < slizes; x++)
            {
                for (int y = 0; y < slizes; y++)
                {
                    // ToDo: DAte info also as folder Hierarchy?
                    using (VideoFileWriter video = new VideoFileWriter())
                    {
                        video.Open(Path.Combine(outDir, $"{startTime.ToString("FF")}__{x}_{y}.mp4"), MOVIE_WIDTH, MOVIE_WIDTH, 32, VideoCodec.H264, 1024 * 1024);
                        Rectangle region = new Rectangle(x * MOVIE_WIDTH, y * MOVIE_WIDTH, MOVIE_WIDTH, MOVIE_WIDTH);

                        for (int i = 0; i < movieFrames.Length; i++)
                        {
                            using (Bitmap frame = NewGrayscale(movieFrames[i])) //.Clone(region, movieFrames[i].PixelFormat)
                            {
                                //Console.Write(i + ",");
                                video.WriteVideoFrame(frame);
                            }
                        }
                        //Console.WriteLine();

                        video.Flush();
                    }
                }
            }
        }

        static void ResizeImages(string directory)
        {
            if (!Directory.Exists(directory))
            {
                throw new ArgumentException();
            }

            foreach (int size in SIZES)
            {
                string dir = Path.Combine(directory, size.ToString());
                if (!Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }
            }

            int counter = 0;
            foreach (var file in Directory.EnumerateFiles(directory))
            {
                if (!String.Equals(".bmp", Path.GetExtension(file), StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                string filename = Path.GetFileNameWithoutExtension(file);

                foreach (int size in SIZES)
                {
                    string smallDirectory = Path.Combine(directory, size.ToString());
                    string smallFileName = Path.Combine(smallDirectory, $"{filename}_{size}.bmp");

                    if (!File.Exists(smallFileName))
                    {
                        using (var image = new ImageMagick.MagickImage(file))
                        {
                            if (image.Width != size)
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

                if (counter % 64 == 0)
                {
                    Console.WriteLine(counter);
                }
            }
        }

        public static Bitmap NewGrayscale(Bitmap original)
        {
            // https://stackoverflow.com/questions/12168654/image-processing-with-lockbits-alternative-to-getpixel
            Rectangle rect = new Rectangle(0, 0, original.Width, original.Height);
            BitmapData data = original.LockBits(rect, ImageLockMode.ReadOnly, original.PixelFormat);
            IntPtr ptr = data.Scan0;

            //declare an array to hold the bytes of the bitmap
            int numBytes = data.Width * original.Height;
            byte[] bytes = new byte[numBytes];
            //copy the RGB values into the array

            // read every 3rd byte
            int skip = data.Stride / data.Width;
            for (int i = 0; i < original.Width * original.Height; i++)
                Marshal.Copy(IntPtr.Add(ptr, i * skip), bytes, i, 1);

            original.UnlockBits(data);


            Bitmap grayBmp = new Bitmap(original.Width, original.Height, PixelFormat.Format8bppIndexed);
            Rectangle grayRect = new Rectangle(0, 0, grayBmp.Width, grayBmp.Height);
            BitmapData grayData = grayBmp.LockBits(grayRect, ImageLockMode.ReadWrite, grayBmp.PixelFormat);
            IntPtr grayPtr = grayData.Scan0;
            int grayBytes = grayData.Stride * grayBmp.Height;

            ColorPalette pal = grayBmp.Palette;

            for (int g = 0; g < 256; g++)
            {
                pal.Entries[g] = Color.FromArgb(g, g, g);
            }

            grayBmp.Palette = pal;

            // copy generated grayscale pixels into new grayscale bitmap
            Marshal.Copy(bytes, 0, grayPtr, grayBytes);

            grayBmp.UnlockBits(grayData);
            return grayBmp;
        }
    }
}
