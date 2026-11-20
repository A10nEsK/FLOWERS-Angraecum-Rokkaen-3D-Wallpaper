"use strict";

const CampusStories = (()=>{
  const cast={
    suo:{name:"白羽苏芳",short:"苏芳",size:1.02},
    may:{name:"匂坂真由理",short:"真由理",size:1,portrait:"sakura-may"},
    rik:{name:"花菱立花",short:"立花",size:1.035},
    eri:{name:"八重垣艾莉卡",short:"艾莉卡",size:.98,chair:true},
    chi:{name:"考崎千鸟",short:"千鸟",size:.99,portrait:"song-chi"},
    yuz:{name:"八代让叶",short:"让叶",size:1.09},
    ner:{name:"小御门奈莉奈",short:"奈莉奈",size:1.07},
    ich:{name:"沙沙贵莓",short:"莓",size:.92},
    rin:{name:"沙沙贵林檎",short:"林檎",size:.92},
    dal:{name:"黛莉娅·巴斯奎亚",short:"黛莉娅",size:1.13}
  };
  const scenes={
    spring:[
      {id:"sakura",name:"樱花道初遇",at:[-22.15,-13.7],size:[10,9,3],camera:[30,31,108],set:"petals",
        cast:[{who:"may",at:[-1.25,.43],yaw:70,portrait:"sakura-may",gesture:"greet"},{who:"suo",at:[1.25,-.43],yaw:346,gesture:"listen"}]},
      {id:"wildflowers",name:"野花间的约定",at:[-9.7,23.75],size:[9,7.8,2],camera:[21,46,109],set:"meadow",
        cast:[{who:"suo",at:[.711,-.271],yaw:143,portrait:"meadow-suo",gesture:"listen"},
          {who:"rik",at:[-.222,-.419],yaw:136,portrait:"meadow-rik",gesture:"talk"}]}
    ],
    summer:[
      {id:"boat",name:"湖心泛舟",at:Angraecum.pondCenter,size:[24,15,3],camera:[348,55,102],set:"boat",
        cast:[{who:"eri",at:[.38,.41],yaw:359,portrait:"boat-eri",gesture:"talk"},
          {who:"chi",at:[-.38,.34],yaw:1,portrait:"boat-chi",gesture:"listen"}]},
      {id:"song",name:"树下初闻歌声",at:[-17.55,-12.15],size:[10.2,8.5,3.5],camera:[52,29,110],set:"song",
        light:[1.113,.92,.77],cast:[{who:"chi",at:[-.70,-.98],yaw:55,portrait:"song-chi",gesture:"sing"},
          {who:"eri",at:[1.05,.72],yaw:157,gesture:"listen"}]}
    ],
    autumn:[
      {id:"picnic",name:"落叶间的野餐",at:[-9.6,34.3],size:[11.6,9.6,2.2],camera:[41,47,108],set:"picnic",
        group:{portrait:"picnic-group",at:[.57,.18],yaw:221},
        cast:[{who:"yuz",at:[.54,.02],yaw:216,portrait:"picnic-yuz",gesture:"listen"},
          {who:"ich",at:[-.68,.44],yaw:205,portrait:"picnic-ich",gesture:"talk"},
          {who:"rin",at:[1.71,.35],yaw:227,portrait:"picnic-rin",gesture:"listen"}]},
      {id:"stars",name:"林边寻星",at:[-10.9,48.7],size:[10.5,8,4],camera:[35,32,107],set:"stars",
        light:[.51,.62,.874],glow:[1.47,1.04,-1.80],
        group:{portrait:"stars-group",at:[.05,.13],roll:-19},
        cast:[{who:"ner",at:[.23,-.13],yaw:22,portrait:"stars-ner",gesture:"point"},
          {who:"yuz",at:[-.75,.06],yaw:326,portrait:"stars-yuz",gesture:"sky"}]}
    ],
    winter:[
      {id:"snowhouse",name:"庭院里的雪屋",at:[4.45,7.22],size:[14,10.3,3.6],camera:[43,35,104],set:"igloo",
        cast:[{who:"suo",at:[1.82,.34],yaw:95,portrait:"snow-suo",gesture:"pat"},{who:"rik",at:[-1.25,-.65],yaw:285,gesture:"pat"},
          {who:"ich",at:[-2.29,-.38],yaw:43,portrait:"snow-ich",gesture:"pat"},
          {who:"rin",at:[-2.55,1.43],yaw:206,portrait:"snow-rin",gesture:"pat"},
          {who:"chi",at:[3.14,.43],yaw:295,portrait:"snow-chi",gesture:"pat"},
          {who:"eri",at:[3.55,-1.24],yaw:298,gesture:"listen"}]},
      {id:"snowwalk",name:"雪径结伴",at:[-10.55,27.65],size:[13,10.5,3.2],camera:[59,38,103],set:"snowwalk",
        cast:[{who:"suo",at:[-.30,.42],yaw:50,portrait:"snowwalk-suo",gesture:"walk"},
          {who:"rik",at:[.04,-.38],yaw:50,portrait:"snowwalk-rik",gesture:"walk"}]}
    ]
  };
  return {cast,scenes};
})();
