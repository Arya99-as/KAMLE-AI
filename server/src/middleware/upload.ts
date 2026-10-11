import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import env from "../config/env.js";
import ApiError from "../utils/ApiError.js";

const uploadRoot = path.resolve(process.cwd(), env.uploadDir);

const ALLOWED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_DOC = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function storageFor(subdir: string) {
  return multer.diskStorage({
    destination(_req, _file, cb) {
      const dir = path.join(uploadRoot, subdir);
      ensureDir(dir);
      cb(null, dir);
    },
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
      const base = path.basename(file.originalname, ext).replace(/[^a-z0-9-_]/gi, "_").slice(0, 40);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base}${ext}`);
    },
  });
}

export const uploadImage = multer({
  storage: storageFor("images"),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 8 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_IMAGE.has(file.mimetype)) {
      return cb(ApiError.badRequest("Only JPG, PNG, WEBP or GIF images are allowed"));
    }
    cb(null, true);
  },
});

export const uploadDocument = multer({
  storage: storageFor("documents"),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 5 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_DOC.has(file.mimetype)) {
      return cb(ApiError.badRequest("Only JPG, PNG, WEBP or PDF documents are allowed"));
    }
    cb(null, true);
  },
});

export { uploadRoot };
