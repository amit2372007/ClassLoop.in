



module.exports.isLoggedIn = (req,res,next) =>{
   if(!req.isAuthenticated()) {
      //redirect url save
    //   req.session.redirectUrl = req.originalUrl;
       req.flash("error" , "Please Login");
      return res.redirect("/login");
   }
   next();
};