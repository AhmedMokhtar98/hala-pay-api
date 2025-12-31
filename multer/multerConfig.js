// middleware/multerConfig.js
const  multer = require('multer');
const  fs = require('fs');

const storage = multer.diskStorage({
	
  destination: (req, file, cb) => {
  if(req.query._id){
    const _id = req.query._id
    const path = req.query.path
    // console.log("_id",req.query._id);
    const DIR = `./uploads/${path}/${_id}`;
    if (!fs.existsSync(DIR)){ fs.mkdirSync(DIR); }
    cb(null, DIR);
  }
  // else if(req.params.folder_name){
  //   const folder_name = req.params.folder_name
  //   const DIR = `./shoptown_public/${folder_name}`;
  //   if (!fs.existsSync(DIR)){ fs.mkdirSync(DIR); }
  //   cb(null, DIR);
  // }
  // else if(req.params.userid ){
  //   const folder_name = req.params.folder_name
  //   const userid = req.params.userid
  //   const DIR = `./shoptown_public/users/${userid}`;
  //   if (!fs.existsSync(DIR)){ fs.mkdirSync(DIR); }
  //   cb(null, DIR);
  // }
  // else{
  //   const DIR = `./shoptown_public/unknown`;
  //   if (!fs.existsSync(DIR)){ fs.mkdirSync(DIR); }
  //   cb(null, DIR);
  // }

  },
  filename: (req, file, cb) => {
    const originalName = file.originalname;
    const extension = originalName.split('.').pop(); // Extract file extension
    const uniqueFilename = Date.now() + '-' + Math.round(Math.random() * 1000) + '.' + extension;
    cb(null, uniqueFilename);
  }
});

const upload = multer({ storage: storage });

module.exports = upload
