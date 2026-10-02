// Mechanical card data transcribed from the base-game cards; effects checked against
// Lookout's 2022 Retail rulebook, pages 13–20. Artwork provenance: assets/sources.json.
export const FOOD = ['strudel', 'cake', 'wine', 'coffee'];
export const FOOD_NAMES = ['苹果卷', '蛋糕', '红酒', '咖啡'];
export const COLOR_NAMES = {blue:'贵族 · 蓝',red:'市民 · 红',yellow:'艺术家 · 黄',green:'旅人 · 绿'};
export const EMPEROR_POINTS = [0,1,2,3,3,4,4,5,5,6,6,7,8,9];
export const MARKET_COST = [3,2,1,0,0];
export const ROOM_COLORS = ['blue','yellow','red','red','blue','yellow','yellow','red','red','yellow','blue','red','blue','yellow','yellow','blue','red','blue','red','blue'];
export const ROOM_GROUPS = [[0],[1,5,6],[2,3,7,8],[4],[9,13,14],[10,15],[11,16],[12,17],[18],[19]];
export const BLUE_BONUS = [0,2,5,9,15];
export const OTHER_BONUS = [0,1,3,6,10];
const e=(type,n=1,extra={})=>({type,n,...extra});
const food=(i,n=1)=>e('food',n,{food:i});
const room=(discount=0,maxFloor=3)=>e('prepare',1,{discount,maxFloor});
const hire=(discount=0)=>e('hire',1,{discount});
const draw=n=>e('draw',n), money=n=>e('money',n), favor=n=>e('favor',n);
const guest=()=>e('guest'), occupy=()=>e('occupy');
const triples=discount=>e('offer',1,{discount});
// ID, English key, Chinese name, order (strudel/cake/wine/coffee), VP, rewards.
const guestRows = [
 [49,'Sculptor','雕塑家','0010',0,[room(99,1)]],
 [50,'Musician','音乐家','0010',0,[draw(1),room()]],
 [51,'Composer','作曲家','0010',1,[food(0)]],
 [52,'Tailor','裁缝','0011',0,[food(0),money(2)]],
 [53,'Dancer','弗拉门戈舞者','1010',0,[food(3),favor(2)]],
 [54,'PortraitPainter','肖像画家','0020',0,[e('anyFood'),money(2)]],
 [55,'Photographer','摄影师','0030',7,[draw(2)]],
 [56,'Vocalist','声乐家','1020',0,[food(1),hire(3)]],
 [57,'Architect','建筑师','0021',1,[room(1),room(1)]],
 [58,'Actress','女演员','0031',7,[occupy()]],
 [59,'Poet','诗人','3010',5,[food(1),hire(2)]],
 [60,'JewelryDesigner','珠宝设计师','0220',5,[food(3),money(3)]],
 [61,'Painter','画家','1030',2,[room(1),room()]],
 [62,'OperaSinger','歌剧演员','1120',4,[guest(),favor(3)]],
 [63,'Dame','贵妇','0001',0,[guest()]],
 [64,'Duchess','女公爵','0001',0,[hire(1)]],
 [65,'KnightOfTheEmpire','帝国骑士','0001',3,[]],
 [66,'Landgrave','领地伯爵','0101',3,[hire(1),room()]],
 [67,'Sovereign','君主','0002',2,[draw(2),favor(2)]],
 [68,'Princess','公主','2001',4,[favor(3)]],
 [69,'Countess','女伯爵','0201',7,[money(3)]],
 [70,'Elector','选帝侯','1011',1,[hire(1),favor(3)]],
 [71,'Baron','男爵','1002',4,[room(99)]],
 [72,'Prince','王子','1101',7,[occupy()]],
 [73,'Count','伯爵','0012',4,[hire(1),hire(1)]],
 [74,'Earl','勋爵','0102',10,[money(1)]],
 [75,'Baroness','女男爵','0022',5,[triples(3)]],
 [76,'Duke','公爵','2002',4,[triples(99)]],
 [77,'Apothecary','药剂师','0100',1,[money(1)]],
 [78,'PostCouncillor','邮政顾问','0100',0,[guest()]],
 [79,'PrivyCouncillor','枢密顾问','0100',0,[money(1),favor(1)]],
 [80,'ProfessorEmeritus','荣休教授','0110',4,[guest()]],
 [81,'General','将军','0200',0,[food(2),money(3)]],
 [82,'SeniorCouncillor','高级顾问','0111',7,[occupy()]],
 [83,'CouncillorOfCommerce','商务顾问','1110',0,[money(5)]],
 [84,'CourtCounsellor','宫廷顾问','0210',2,[money(3),guest()]],
 [85,'Major','少校','2100',3,[money(3)]],
 [86,'VeterinaryCouncillor','兽医顾问','0120',3,[hire(3)]],
 [87,'MedicinalCouncillor','医疗顾问','0202',3,[money(3),guest(),guest()]],
 [88,'Procurator','检察官','0130',0,[room(99),room(99)]],
 [89,'LordHighCommissioner','高级专员','2110',5,[money(4)]],
 [90,'SeniorLegalSecretary','高级法务秘书','1300',7,[food(2),money(3)]],
 [91,'Tezcatlipoca','特斯卡特利波卡','1000',0,[draw(3)]],
 [92,'CaptGoldhaken','金钩船长','1000',0,[money(1)]],
 [93,'MrHorsa','霍萨先生','1000',0,[favor(1)]],
 [94,'MichaelIngalls','英格尔斯','2000',0,[hire(1)]],
 [95,'MrBoydell','博伊德尔先生','1100',2,[favor(2)]],
 [96,'MrOundo','翁多先生','1001',0,[hire(3)]],
 [97,'EGizia','吉萨先生','2010',4,[e('bonusDie')]],
 [98,'MPolo','马可·波罗','3000',0,[money(4)]],
 [99,'Cramersopholus','克拉默索菲勒斯','1200',5,[draw(1),favor(2)]],
 [100,'FarmerFranz','农夫弗朗茨','1003',4,[favor(3),occupy()]],
 [101,'BrotherUwe','乌韦修士','3001',3,[favor(3),guest()]],
 [102,'Conductor','列车长','1001',0,[favor(1),occupy()]],
 [103,'Durgoing','杜尔戈因','1010',4,[draw(2)]],
 [104,'MacLeod','麦克劳德','2200',2,[hire(99)]]
];
export const GUESTS = Object.fromEntries(guestRows.map(([id,key,name,order,vp,rewards])=>[id,{id,key,name,order:[...order].map(Number),vp,rewards,color:id<63?'yellow':id<77?'blue':id<91?'red':'green',image:`/assets/guest${key}.gif`}]));
const staffRows = [
 [1,'BreakfastServer','早餐侍者',4,'round','每轮获得 1 苹果卷。'],
 [2,'Waitress','女侍者',6,'round','每轮获得 1 蛋糕。'],
 [3,'Barkeeper','酒保',4,'round','每轮获得 1 红酒。'],
 [4,'SousChef','副厨师长',6,'round','每轮获得 1 咖啡。'],
 [5,'Groom','门童',4,'permanent','红色客人入住后，获得 2 克朗。'],
 [6,'Stableman','马夫',1,'permanent','蓝色客人入住后，皇帝轨道前进 1 格。'],
 [7,'Masseuse','按摩师',1,'permanent','黄色客人入住后，获得 1 克朗。'],
 [8,'TourGuide','导游',2,'permanent','绿色客人入住后，额外获得 2 分。'],
 [9,'Butler','管家',5,'permanent','准备蓝色客房免付楼层费用。'],
 [10,'Chauffeur','司机',5,'permanent','准备红色客房免付楼层费用。'],
 [11,'Florist','花艺师',5,'permanent','准备黄色客房免付楼层费用。'],
 [12,'ExecutiveHousekeeper','行政房务主管',2,'permanent','取走点数 3 或 4 的骰子时，获得 2 分。'],
 [13,'RestaurantManager','餐厅经理',2,'permanent','取走点数 1 或 2 的骰子时，行动强度 +1。'],
 [14,'Decorator','装饰师',2,'permanent','取走点数 1 或 2 的骰子时，可以额外准备 1 间房，正常付费。'],
 [15,'Bootblack','擦鞋匠',4,'permanent','取走点数 4 的骰子时，每点强度同时获得金钱和皇帝声望。'],
 [16,'Laundress','洗衣工',2,'permanent','取走点数 4 的骰子时，获得 4 分。'],
 [17,'KitchenHand5','厨房帮工',5,'permanent','取走点数 6 的骰子免付模仿费，行动强度 +1。'],
 [18,'Checker','核账员',2,'permanent','取走点数 5 的骰子时，雇佣折扣额外 +2。'],
 [19,'InteriorArchitect','室内设计师',3,'permanent','取走点数 3 的骰子时，获得 5 分。'],
 [20,'Detective','侦探',2,'permanent','取走点数 5 的骰子时，皇帝轨道前进 2 格。'],
 [21,'Chef','主厨',3,'once','立即获得四种餐饮各 1 份。'],
 [22,'StaffManager','人事经理',3,'permanent','取走点数 3 的骰子时，可以按原价额外雇佣 1 名员工。'],
 [23,'Custodian','管理员',5,'permanent','每次使 1 间房变为已入住，获得 1 克朗。'],
 [24,'ChiefWaiter','领班',1,'permanent','从厨房向客人送餐免费。'],
 [25,'DeliveryBoy','送货员',6,'permanent','接待队列中的客人免付接待费。'],
 [26,'ConferenceManager','会议经理',5,'permanent','皇帝结算时，可支付 1 克朗免除惩罚。'],
 [27,'BookingManager','预订经理',4,'end','终局：每间已入住红房 +3 分。'],
 [28,'Concierge','礼宾员',4,'end','终局：每间已入住蓝房 +3 分。'],
 [29,'Secretary','秘书',5,'end','终局：选择一名对手的终局员工，按你的酒店计算其效果。'],
 [30,'ReceptionClerk','接待员',4,'end','终局：每间已入住黄房 +3 分。'],
 [31,'Chambermaid','客房女佣',4,'end','终局：每间已入住房间 +1 分。'],
 [32,'AssistantManager','副经理',4,'end','终局：每名已雇佣员工 +2 分，包含自己。'],
 [33,'MaleFloorHousekeeper','男楼层管家',5,'permanent','满足需求总数至少 4 的客人入住后，额外 +4 分。'],
 [34,'Receptionist','前台',5,'end','终局：每间已准备或已入住房间 +1 分。'],
 [35,'Pageboy','侍童',2,'once','立即将最多 2 间已准备客房改为已入住。'],
 [36,'Sommelier','侍酒师',2,'once','立即获得 4 红酒。'],
 [37,'RoomService','客房服务员',3,'end','终局：每个全部入住的房间组 +2 分。'],
 [38,'Porter','行李员',5,'once','立即免费满足 1 位客人的全部餐饮需求。'],
 [39,'Confectioner','甜点师',3,'once','立即获得 4 蛋糕。'],
 [40,'MarketingDirector','市场总监',2,'end','终局：每张已完成目标卡 +5 分。'],
 [41,'Operator','话务员',3,'end','终局：最后的皇帝轨道位置 ×2 分。'],
 [42,'Gardener','园丁',3,'permanent','每次获得皇帝奖励时，额外 +5 分。'],
 [43,'Barista','咖啡师',3,'once','立即获得 4 咖啡。'],
 [44,'LarderCook','备餐厨师',2,'once','立即获得 4 苹果卷。'],
 [45,'PoolAttendant','泳池服务员',1,'once','立即在皇帝轨道前进 3 格。'],
 [46,'FemaleFloorHousekeeper','女楼层管家',2,'end','终局：每个全部入住的楼层 +5 分。'],
 [47,'Liftboy','电梯员',4,'end','终局：每个全部入住的列 +5 分。'],
 [48,'HotelManager','酒店经理',4,'end','终局：每套红、蓝、黄已入住房间 +4 分。']
];
export const STAFF=Object.fromEntries(staffRows.map(([id,key,name,cost,kind,text])=>[id,{id,key,name,cost,kind,text,image:`/assets/staff${key}.gif`}]));
export const STAFF_EFFECTS={21:[0,1,2,3].map(i=>food(i)),35:[occupy(),occupy()],36:[food(2,4)],38:[e('complete')],39:[food(1,4)],43:[food(3,4)],44:[food(0,4)],45:[favor(3)]};
export const OBJECTIVES=[
 {id:105,group:'A',text:'拥有 20 克朗',test:'money'},
 {id:106,group:'A',text:'准备或入住至少 12 间房',test:'prepared'},
 {id:107,group:'A',text:'雇佣至少 6 名员工',test:'staff'},
 {id:108,group:'A',text:'皇帝声望至少 10',test:'emperor'},
 {id:109,group:'B',text:'至少 2 个楼层全部入住',test:'rows'},
 {id:110,group:'B',text:'至少 6 个房间组全部入住',test:'groups'},
 {id:111,group:'B',text:'一种颜色的全部房间均已入住',test:'color'},
 {id:112,group:'B',text:'至少 2 列全部入住',test:'cols'},
 {id:113,group:'C',text:'红、黄、蓝各入住至少 3 间',test:'rgb'},
 {id:114,group:'C',text:'至少入住 4 红房和 3 黄房',test:'ry'},
 {id:115,group:'C',text:'至少入住 4 黄房和 3 蓝房',test:'yb'},
 {id:116,group:'C',text:'至少入住 4 蓝房和 3 红房',test:'br'}
];
export const EMPERORS=[
 {id:'A1',bonus:[money(3)],reward:'获得 3 克朗',penalty:'支付 3 克朗；不足则扣 5 分'},
 {id:'A2',bonus:[e('anyFood',2)],reward:'任选 2 份餐饮',penalty:'清空厨房餐饮'},
 {id:'A3',bonus:[triples(3)],reward:'抽 3 名员工，选 1 名折扣 3 雇佣',penalty:'弃掉 2 张手牌；不足则扣 5 分'},
 {id:'A4',bonus:[room(99)],reward:'免费准备 1 间房',penalty:'移除最高层的 1 间空房；没有则扣 5 分'},
 {id:'B1',bonus:[0,1,2,3].map(i=>food(i)),reward:'获得四种餐饮各 1 份',penalty:'清空厨房及客人上的餐饮'},
 {id:'B2',bonus:[money(5)],reward:'获得 5 克朗',penalty:'支付 5 克朗；不足则扣 7 分'},
 {id:'B3',bonus:[triples(99)],reward:'抽 3 名员工，选 1 名免费雇佣',penalty:'弃掉 3 张手牌；不足则扣 7 分'},
 {id:'B4',bonus:[e('prepareOccupy',1,{discount:99,maxFloor:1})],reward:'免费准备并入住底部两层的 1 间房',penalty:'从最高层起移除 2 间空房；不足则扣 7 分'},
 {id:'C1',bonus:[e('points',8)],reward:'获得 8 分',penalty:'扣 8 分'},
 {id:'C2',bonus:[e('prepareOccupy',1,{discount:99,maxFloor:3})],reward:'免费准备并入住任意 1 间房',penalty:'最高的两个有住客楼层各移除 1 间已入住房间'},
 {id:'C3',bonus:[e('staffPoints',2)],reward:'每名已雇佣员工 +2 分',penalty:'每名已雇佣员工 −2 分'},
 {id:'C4',bonus:[hire(99)],reward:'免费雇佣 1 名手牌员工',penalty:'弃掉 1 名已雇佣终局员工；没有则扣 10 分'}
];
export function rewardText(x) {
 const special={dishes:`获得 ${x.n} 份${x.pair===0?'餐点':'饮品'}`,funds:`分配 ${x.n} 点金钱与皇帝声望`,penalty:'结算皇帝惩罚',discardHand:`将 ${x.n} 张员工手牌放回牌底`,discardStaff:'移除一名已雇佣终局员工',removeRoom:'移除指定楼层的房间'};
 if(special[x.type])return special[x.type];
 const names={prepare:`准备 1 间房${x.discount===99?'（免费）':x.discount?`（省 ${x.discount} 克朗）`:''}${x.maxFloor===1?' · 底部两层':''}`,prepareOccupy:'免费准备并入住 1 间房',hire:`雇佣 1 名员工${x.discount===99?'（免费）':x.discount?`（省 ${x.discount} 克朗）`:''}`,draw:`抽 ${x.n} 张员工牌`,money:`+${x.n} 克朗`,favor:`+${x.n} 皇帝声望`,points:`+${x.n} 分`,food:`+${x.n} ${FOOD_NAMES[x.food]}`,anyFood:`任选 ${x.n} 份餐饮`,guest:'免费接待 1 位客人',occupy:'额外入住 1 间空房',offer:`抽 3 选 1 雇佣${x.discount===99?'（免费）':`（省 ${x.discount} 克朗）`}`,bonusDie:'额外执行一次骰子行动',complete:'满足 1 位客人的全部需求',staffPoints:`每名已雇佣员工 +${x.n} 分`};
 return names[x.type]||x.type;
}
