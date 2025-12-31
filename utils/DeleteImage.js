const fs = require('fs');
const path = require('path');

const deleteFile = (baseDir, relativePath) => {
  // Construct the full local filesystem path
  const fullPath = path.join(baseDir, relativePath);
  console.log("fullPath", fullPath); // Log the full path for debugging
  
  // Check if the file exists before attempting to delete
  if (!fs.existsSync(fullPath)) {
    return { success: false, error: 'fileNotFound' };
  }
  
  // Remove the file
  try {
    fs.unlinkSync(fullPath);
    return { success: true };
  } catch (err) {
    console.error('Error deleting file:', err);
    return { success: false, error: 'deleteError' };
  }
};

module.exports = { deleteFile };
