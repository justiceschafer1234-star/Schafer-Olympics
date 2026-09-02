import app from './worker-tournament-clear.js';

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/api/scores'&&request.method==='GET'){
      const response=await app.fetch(request,env,ctx);
      const text=await response.text();
      let data;
      try{data=text?JSON.parse(text):{}}catch{return new Response(text,{status:response.status,headers:response.headers})}
      if(response.ok&&Array.isArray(data.rows)){
        data.rows=data.rows.map(row=>{
          const p={...(row.properties||{})};
          const bronze1=Array.isArray(p['Bronze 1 Team'])?p['Bronze 1 Team']:(p['Bronze 1 Team']?[p['Bronze 1 Team']]:[]);
          p['🥉 Team']=bronze1;
          p['🥉 Bronze Points']=Number(p['Bronze 1 Points']||0);
          return {...row,properties:p};
        });
      }
      return json(data,response.status);
    }
    return app.fetch(request,env,ctx);
  }
};
