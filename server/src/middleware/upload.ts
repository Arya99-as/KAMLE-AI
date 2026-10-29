import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import env from "../config/env.js";
import ApiError from "../utils/ApiError.js";

const uploadRoot = path.resolve(process.cwd(), env.uploadDir);

const ALLOWED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_DOC = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
};

const ALLOWED_EXT_IMAGE = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const ALLOWED_EXT_DOC = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function isAllowedExt(ext: string, set: Set<string>) {
  return set.has(ext.toLowerCase());
}

function storageFor(subdir: string) {
  return multer.diskStorage({
    destination(_req, _file, cb) {
      const dir = path.join(uploadRoot, subdir);
      ensureDir(dir);
      cb(null, dir);
    },
    filename(_req, file, cb) {
      const extFromMime = MIME_TO_EXT[file.mimetype] || "";
      const extFromName = path.extname(file.originalname).toLowerCase();
      const ext = extFromMime || (extFromName.length <= 10 ? extFromName : "");
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  });
}

function imageFileFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_IMAGE.has(file.mimetype)) {
    return cb(ApiError.badRequest("Only JPG, PNG, WEBP or GIF images are allowed"));
  }
  if (!isAllowedExt(ext, ALLOWED_EXT_IMAGE)) {
    return cb(ApiError.badRequest("Invalid image file extension"));
  }
  cb(null, true);
}

function documentFileFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_DOC.has(file.mimetype)) {
    return cb(ApiError.badRequest("Only JPG, PNG, WEBP or PDF documents are allowed"));
  }
  if (!isAllowedExt(ext, ALLOWED_EXT_DOC)) {
    return cb(ApiError.badRequest("Invalid document file extension"));
  }
  cb(null, true);
}

export const uploadImage = multer({
  storage: storageFor("images"),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 8 },
  fileFilter: imageFileFilter,
});

export const uploadDocument = multer({
  storage: storageFor("documents"),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 5 },
  fileFilter: documentFileFilter,
});

export { uploadRoot };
