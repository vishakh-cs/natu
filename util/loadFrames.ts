
export const loadFrames = (path: string, count: number) => {
  const images: HTMLImageElement[] = [];

  for (let i = 1; i <= count; i++) {
    const img = new Image();
    img.src = `${path}/${String(i).padStart(4, "0")}.jpg`;
    images.push(img);
  }

  return images;
};