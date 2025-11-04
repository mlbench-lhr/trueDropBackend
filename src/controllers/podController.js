const Pod = require("../models/Pod");
const logger = require("../utils/logger");

async function createPod(req, res, next) {
  try {
    const { name, description, members, privacyLevel } = req.body;
    const userId = req.user.userId;
    const dataToSave = new Pod({
      name,
      description,
      members: [...members, userId],
    });
    const createdPod = await dataToSave.save();
    console.log("createdPod---------", createdPod);

    return res.status(201).json({
      status: true,
      message: `Pod added successfully`,
      data: {
        _id: createdPod?._id,
        name: createdPod?.name,
        members: createdPod?.members,
        description: createdPod?.description,
        lastActiveTime: createdPod?.lastActiveTime,
        chat: createdPod?.chat,
        createdAt: createdPod?.createdAt,
      },
    });
  } catch (err) {
    logger.error("Add pod error", err);
    next(err);
  }
}

module.exports = { createPod };
