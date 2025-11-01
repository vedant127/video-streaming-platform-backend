import {v2 as cloudinary} from "cloudinary"
import fs from "fs"


cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
  });


const uploadOnCloudinary = async (LocalFilePath) => {
    try {
        if (!LocalFilePath) {
            console.error('Cloudinary: No local file path provided');
            return null;
        }

        // Check if file exists
        if (!fs.existsSync(LocalFilePath)) {
            console.error('Cloudinary: Local file does not exist:', LocalFilePath);
            return null;
        }

        // Check Cloudinary configuration
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            console.error('Cloudinary: Missing environment variables. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
            return null;
        }

        // Upload the file on cloudinary
        const response = await cloudinary.uploader.upload(LocalFilePath, {
            resource_type: 'auto',
        });

        if (!response || !response.url) {
            console.error('Cloudinary: Upload succeeded but no URL in response');
            return null;
        }

        // Remove the locally saved temporary file after successful upload
        try {
            if (fs.existsSync(LocalFilePath)) {
                fs.unlinkSync(LocalFilePath);
            }
        } catch (fsErr) {
            console.error('Cloudinary: Failed to remove local file after upload:', fsErr);
        }

        console.log('Cloudinary: File uploaded successfully:', response.url);
        return response;
    } catch (error) {
        console.error('Cloudinary upload error:', error.message || error);
        console.error('Full error:', error);
        
        // Remove the locally saved temporary file as the upload operation failed
        try {
            if (LocalFilePath && fs.existsSync(LocalFilePath)) {
                fs.unlinkSync(LocalFilePath);
            }
        } catch (fsErr) {
            console.error('Cloudinary: Failed to remove local file after error:', fsErr);
        }
        return null;
    }
};

export {uploadOnCloudinary}