let io = null;
exports.setIO = i => { io = i; };
exports.emitOrg = (org, ev, p) => io && io.to('org:' + org).emit(ev, p);
exports.emitUser = (u, ev, p) => io && io.to('user:' + u).emit(ev, p);
