/**
 * 图片压缩工具
 * 将图片压缩到指定大小以下，支持裁切为正方形
 */

interface CompressOptions {
  maxSizeMB?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  cropToSquare?: boolean;
}

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<string> {
  const {
    maxSizeMB = 1,
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.8,
    cropToSquare = true
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('无法创建canvas上下文'));
          return;
        }

        let width = img.width;
        let height = img.height;
        let sx = 0, sy = 0, sw = width, sh = height;

        // 如果需要裁切为正方形
        if (cropToSquare) {
          const minDim = Math.min(width, height);
          sw = minDim;
          sh = minDim;
          sx = (width - minDim) / 2;
          sy = (height - minDim) / 2;
          width = minDim;
          height = minDim;
        }

        // 计算缩放后的尺寸
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;

        // 绘制图片
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);

        // 转换为base64
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        // 如果还是太大，继续降低质量
        let currentQuality = quality;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        
        while (dataUrl.length > maxSizeBytes * 1.37 && currentQuality > 0.1) {
          currentQuality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
        }

        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}