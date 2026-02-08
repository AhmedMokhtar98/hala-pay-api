// routes/admin/group.route.js
const router = require("express").Router();

const groupController = require("../../controllers/admin/group.controller");
const validator = require("../../helpers/validation.helper");
const errorHandler = require("../../middlewares/errorHandler");

const {
  createGroupValidation,
  groupIdParamsValidation,
  updateGroupValidation,
  deleteGroupValidation,
  uploadGroupImageValidation,
  removeGroupImageValidation,
} = require("../../validations/group.validation");

const { uploadImage } = require("../../multer/uploadImage");
const groupImageUpload = uploadImage({ module: "groups", idParam: "groupId" });
// _____________________________________________ ROUTES _________________________________________________ // 

router.post("/", validator(createGroupValidation), errorHandler(groupController.createGroup));

router.put( "/image", validator(uploadGroupImageValidation), groupImageUpload.single("image"), errorHandler(groupController.uploadGroupImage) );

router.delete( "/image/remove", validator(removeGroupImageValidation), errorHandler(groupController.removeGroupImage) );

router.put( "/:_id", validator(updateGroupValidation), errorHandler(groupController.updateGroup) );

router.get( "/", errorHandler(groupController.listGroups) );

router.get( "/:_id", validator(groupIdParamsValidation), errorHandler(groupController.getGroupDetails) );

router.delete( "/:_id", validator(deleteGroupValidation), errorHandler(groupController.deleteGroup) );

module.exports = router;
