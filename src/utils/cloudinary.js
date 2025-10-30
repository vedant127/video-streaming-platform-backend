import {v2 as cloudinary} from "cloudinary"
import fs from "fs"


cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
  });


const uploadOnCloudinary = async (LocalFilePath) => {
    try {
        if (!LocalFilePath) return null;
        // upload the file on cloudinary
        const response = await cloudinary.uploader.upload(LocalFilePath, {
            resource_type: 'auto',
        });
        // .log('File isconsole uploaded on Cloudinary:', response.url);
        fs.unlink(LocalFilePath);
        return response;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        // remove the locally saved temporary file as the upload operation got failed
        try {
            if (LocalFilePath && fs.existsSync(LocalFilePath)) {
                fs.unlinkSync(LocalFilePath);
            }
        } catch (fsErr) {
            console.error('Failed to remove local file after Cloudinary upload error:', fsErr);
        }
        return null;
    }
};

export {uploadOnCloudinary}