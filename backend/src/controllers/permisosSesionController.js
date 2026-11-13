const seguridad=require('../security/pg2');
exports.obtener=async(req,res)=>{res.set('Cache-Control','no-store');try{if(Object.keys(req.query).length)throw seguridad.error(400,'Parametros no admitidos');const {u,permisos}=await seguridad.permisos(req);res.json({ok:true,version:1,permisos,sucursal:u.id_sucursal,actualizado_en:new Date().toISOString()});}catch(e){seguridad.responder(res,e);}};
