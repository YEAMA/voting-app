const { ObjectID } = require('mongodb');

var authObjID = (req, res, next) => {
    var objID = req.params.id;
    if (!ObjectID.isValid(objID)) {
        return res.status(404).render('404');
    }
    next();
}

module.exports = { authObjID }