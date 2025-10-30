import multer from "multer";


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use correct relative path for Node.js backend
    cb(null, 'public/temp'); // No leading slash!
  },
  filename: function (req, file, cb) {
    const ext = file.originalname.split('.').pop();
    const fname = `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`;
    cb(null, fname);
  }
});

export const upload = multer({ 
   storage, 
})