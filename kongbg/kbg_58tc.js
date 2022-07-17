/*
58同城

安卓貌似需要root才能捉到包，IOS随便捉
多账号切换账号不能退出登录

手动捉包把PPU=UID=xxxx&UN=yyyy&...填到wbtcCookie里，多账号@隔开
注意前面有个PPU=，捉包只有UID=xxx的话手动加上

自定义UA：填到wbtcUA里，不填默认IOS15的UA

只做普通任务一天3毛左右，跑小游戏的话一天5毛到6毛
账号能刷到新手奖励的话每天额外8毛4，前七天还有每天额外3毛(满5提现到矿石)，第一天做完新手任务就能提5块
先登录，点我的->神奇矿->装扮我的家，过了引导剧情，然后再跑脚本
游戏赚矿石里的三个小游戏需要投入矿石去赚更多，脚本默认不跑
如果要跑，在wbtcCookie的对应账号后面加上#1，但是跑久了有可能触发滑块，需要自己去点一次，否则要被反撸矿石

定时不跑小游戏就每天7点后跑5次，跑小游戏就每小时一次

新增合成房子/车子，车子要等房子15级以后才解锁
需要运行这个脚本先去完成游戏引导
合成房子路径：神奇矿主页-》提现-》最下面的‘玩游戏领大奖’， 进去完成游戏引导就可以了，不然会自动跳过。
一小时运行一次
crontab表达式：0 * * * *

V2P/圈叉：
[task_local]
#58同城
7 * * * * https://raw.githubusercontent.com/leafxcy/JavaScript/main/58tc.js, tag=58同城, enabled=true
[rewrite_local]
https://magicisland.58.com/web/sign/getIndexSignInInfo url script-request-header https://raw.githubusercontent.com/leafxcy/JavaScript/main/58tc.js
[Script]
cron "1 * * * *" script-path=https://raw.githubusercontent.com/leafxcy/JavaScript/main/58tc.js, tag=58同城, enabled=true
[MITM]
hostname = magicisland.58.com
*/
const jsname = '58同城'
const $ = Env(jsname)
const logDebug = 0

const notifyFlag = 1; //0为关闭通知，1为打开通知,默认为1
const notify = $.isNode() ? require('./sendNotify') : '';
let notifyStr = ''

let httpResult //global buffer

let userCookie = ($.isNode() ? process.env.wbtcCookie : $.getdata('wbtcCookie')) || '';
let userUA = ($.isNode() ? process.env.wbtcUA : $.getdata('wbtcUA')) || 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WUBA/10.26.5';
let userCookieArr = []
let ck = ''
let userList = []

let userIdx = 0
let userCount = 0

//let taskList = [1,2,3,4,5,6,7,9,10,13,15,16]
let taskList = [9,10,13]
let TASK_TIME = [7,24]
let attendType = {'oneDay':'一天打卡', 'multiDay':'三天打卡'}

let curHour = (new Date()).getHours()

let maxTaskLen = 0
let maxRewardLen = 0

///////////////////////////////////////////////////////////////////
class UserInfo {
    constructor(str) {
        let strArr = str.split('#')
        this.index = ++userIdx
        this.cookie = strArr[0]
        this.cashSign = true
        this.newbie = {}
        this.house = {}
        this.mining = {}
        this.auction = {}
        this.ore = {}
        this.task = []
        this.reward = []
        this.runTask = strArr[1] || 0
        this.maininfo = {} // 梦想小镇详情
        this.compoundHouse = 0 // 已经合成次数
        this.canCompoundHouse = 50 // 可合成最大次数
        this.sellBuildNum = 0 // 售卖次数
        this.waitTime = 30000 // 等待时间
        this.buyNum = 0 // 购买建筑次数
        this.showCar = false // 是否展示过车等级信息
        this.showHouse = false // 是否展示过房子等级信息
        this.compoundType = 'house'
        
        let taskStr = this.runTask==1 ? '投入' : '不投入'
        console.log(`账号[${this.index}]现在小游戏矿石设置为：${taskStr}`)
    }
    
    async getTaskList(sceneId) {
        let url = `https://taskframe.58.com/web/task/dolist?sceneId=${sceneId}&openpush=0&source=`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            if(!result.result.taskList) return;
            //status: 0 - 未完成，1 - 已完成，2 - 已领取
            for(let task of result.result.taskList) {
                let doneStr = ''
                if(task.taskTotalCount) {
                    doneStr = ` ${task.taskDoneCount}/${task.taskTotalCount}`
                }
                let statusStr = (task.status==0) ? '未完成' : ((task.status==1) ? '已完成' : '已领取')
                console.log(`账号[${this.index}]任务[${sceneId}-${task.itemId}]:${doneStr} +${task.rewardDisplayValue} ${statusStr}`)
                if(task.status == 0) {
                    this.task.push({sceneId:sceneId,taskId:task.itemId})
                } else if(task.status == 1) {
                    this.reward.push({sceneId:sceneId,taskId:task.itemId})
                }
            }
        } else {
            console.log(`账号[${this.index}]查询任务列表失败: ${result.message}`)
        }
    }
    
    async doTask(sceneId,taskId) {
        var time = `${(new Date()).getTime()}`
        var signo = `${time}${taskId}`
        let url = `https://taskframe.58.com/web/task/dotask?timestamp=${time}&sign=${MD5Encrypt(signo)}&taskId=${taskId}`//&taskData=15`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            console.log(`账号[${this.index}]完成任务[${sceneId}-${taskId}]`)
        } else {
            console.log(`账号[${this.index}]完成任务[${sceneId}-${taskId}]失败: ${result.message}`)
        }
    }
    
    async getReward(sceneId,taskId) {
        var time = `${(new Date()).getTime()}`
        var signo = `${time}${taskId}`
        let url = `https://taskframe.58.com/web/task/reward?timestamp=${time}&sign=${MD5Encrypt(signo)}&taskId=${taskId}`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            console.log(`账号[${this.index}]领取任务[${sceneId}-${taskId}]奖励成功`)
        } else {
            console.log(`账号[${this.index}]领取任务[${sceneId}-${taskId}]奖励失败: ${result.message}`)
        }
    }
    
    async newbieMaininfo() {
        let url = `https://rightsplatform.58.com/web/motivate/maininfo`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            this.newbie.coin = parseFloat(result.result.coin)
            this.newbie.isWithdraw = result.result.userWithdraw
            if(result.result.todaySignDay<=7) {
                this.newbie.signItem = result.result.signInfo[result.result.todaySignDay-1]
                let signStr = (this.newbie.signItem.status==0) ? '未签到' : '已签到'
                console.log(`账号[${this.index}]今日新手任务${signStr}`)
                if(this.newbie.signItem.status == 0) {
                    await $.wait(500)
                    await this.newbieSign()
                }
            }
            console.log(`账号[${this.index}]新手金币余额：${this.newbie.coin}`)
            if(this.newbie.isWithdraw==false) {
                let sortList = result.result.withdrawInfo.sort(function(a,b) {return b.cardAmount-a.cardAmount})
                for(let withItem of sortList) {
                    if(this.newbie.coin >= withItem.cardCoin) {
                        await $.wait(500)
                        await this.newbieWithdraw(withItem)
                    }
                }
            }
        } else {
            console.log(`账号[${this.index}]查询新手主页失败: ${result.message}`)
        }
    }
    
    async newbieSign() {
        let url = `https://rightsplatform.58.com/web/motivate/sign`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            this.newbie.coin += parseFloat(this.newbie.signItem.signCoin)
            console.log(`账号[${this.index}]新手任务第${this.newbie.signItem.number}天签到成功，获得${this.newbie.signItem.signCoin}金币`)
        } else {
            console.log(`账号[${this.index}]新手任务签到失败: ${result.message}`)
        }
    }
    
    async newbieWithdraw(withItem) {
        let url = `https://rightsplatform.58.com/web/motivate/withdraw`
        let body = `id=${withItem.id}`
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            console.log(`账号[${this.index}]成功兑换${withItem.cardAmount}元到矿石余额`)
        } else {
            console.log(`账号[${this.index}]兑换${withItem.cardAmount}元到矿石余额失败: ${result.message}`)
        }
    }
    
    async houseSignStatus() {
        let url = `https://lovely-house.58.com/sign/info`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            for(let item of result.result) {
                if(item.today == true) {
                    let signStr = (item.sign==false) ? '未签到' : '已签到'
                    console.log(`账号[${this.index}]今日我的家${signStr}`)
                    if(item.sign == false) {
                        await $.wait(500)
                        await this.houseSign()
                    }
                    break;
                }
            }
        } else {
            console.log(`账号[${this.index}]查询我的家签到状态失败: ${result.message}`)
        }
    }
    
    async houseSign() {
        let url = `https://lovely-house.58.com/sign/signin`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            console.log(`账号[${this.index}]我的家签到成功，获得${result.result.gold}金币`)
        } else {
            console.log(`账号[${this.index}]我的家签到失败: ${result.message}`)
        }
    }
    
    async houseWithdrawPage() {
        let url = `https://lovely-house.58.com/web/exchange/info`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            this.house.coin = result.result.coin
            console.log(`账号[${this.index}]我的家金币余额：${this.house.coin}`)
            let sortList = result.result.oreList.sort(function(a,b) {return b.amount-a.amount})
            if(sortList.length>0 && sortList[0].oreStatus == 0 && this.house.coin >= sortList[0].coin) {
                await $.wait(500)
                await this.houseWithdraw(sortList[0])
            }
        } else {
            console.log(`账号[${this.index}]查询我的家兑换页失败: ${result.message}`)
        }
    }
    
    async houseWithdraw(withItem) {
        let url = `https://lovely-house.58.com/web/exchange/ore`
        let body = `id=${withItem.id}`
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            console.log(`账号[${this.index}]成功兑换${withItem.amount}矿石 ≈ ${withItem.money}元`)
        } else {
            console.log(`账号[${this.index}]兑换${withItem.amount}矿石失败: ${result.message}`)
        }
    }
    
    async oreMainpage(dotask=true) {
        let url = `https://magicisland.58.com/web/mineral/main?openSettings=0`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            this.ore.sign = result.result.tasks.sign.state
            this.ore.dailyore = result.result.userInfo.dailyOre
            this.ore.ore = parseFloat(result.result.userInfo.minerOre)
            this.ore.money = parseFloat(result.result.userInfo.minerOreValue)
            if(dotask) {
                let gameStatus = result.result.games.gameProcess
                let gameStr = ''
                if(gameStatus.awardState==0) {
                    if(gameStatus.gameNum==gameStatus.joinedNum) {
                        this.ore.gameFlag = 1
                        gameStr = '已完成'
                    } else {
                        this.ore.gameFlag = 0
                        gameStr = '未完成'
                    }
                } else {
                    this.ore.gameFlag = 2
                    gameStr = '已领取'
                }
                let signStr = (this.ore.sign==0) ? '未签到' : '已签到'
                let dailyStr = (this.ore.dailyore==0) ? '未采集' : '已采集'
                console.log(`账号[${this.index}]今日神奇矿${dailyStr}，${signStr}，参加三个小游戏任务${gameStr}`)
                if(this.ore.sign==0) {
                    await $.wait(500)
                    await this.oreSign()
                }
                if(this.ore.dailyore==0) {
                    await $.wait(500)
                    await this.getDailyore()
                }
                if(this.ore.gameFlag==1) {
                    await $.wait(500)
                    await this.oreGameScore()
                }
                console.log(`账号[${this.index}]神奇矿余额${this.ore.ore} ≈ ${this.ore.money}元`)
            }
        } else {
            console.log(`账号[${this.index}]查询神奇矿主页失败: ${result.message}`)
        }
    }
    
    async getDailyore() {
        let url = `https://magicisland.58.com/web/mineral/dailyore`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            console.log(`账号[${this.index}]采集神奇矿成功`)
        } else {
            console.log(`账号[${this.index}]采集神奇矿失败: ${result.message}`)
        }
    }
    
    async oreSign() {
        let url = `https://magicisland.58.com/web/sign/signInV2?sessionId=&successToken=&scene=null`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            this.ore.ore += parseFloat(result.result.ore)
            this.ore.money += parseFloat(result.result.amount)
            console.log(`账号[${this.index}]神奇矿签到成功，获得${result.result.ore}矿石 ≈ ${result.result.amount}元`)
        } else {
            console.log(`账号[${this.index}]神奇矿签到失败: ${result.message}`)
        }
    }
    
    async miningUserInfo() {
        let url = `https://magicisland.58.com/web/mining/userInfo`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            this.mining.enroll = result.result.status
            let enrollStr = (this.mining.enroll==0) ? '未召唤小帮手' : '已召唤小帮手'
            console.log(`账号[${this.index}]神奇矿山${enrollStr}`)
            if(result.result.grantList && result.result.grantList.length > 0) {
                for(let mines of result.result.grantList) {
                    await $.wait(500)
                    await this.miningGain(mines.id)
                }
                this.mining.enroll = 0
            }
            if(this.runTask == 1 && this.mining.enroll==0) {
                if(parseFloat(result.result.usableOre) >= result.result.threshold) {
                    await $.wait(500)
                    await this.miningEnroll()
                } else {
                    console.log(`账号[${this.index}]可用矿石余额${result.result.usableOre}不足，不能花费${result.result.threshold}矿石召唤小帮手`)
                }
            }
        } else {
            console.log(`账号[${this.index}]查询神奇矿山主页失败: ${result.message}`)
        }
    }
    
    async miningGain(id) {
        let url = `https://magicisland.58.com/web/mining/gain?id=${id}`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            console.log(`账号[${this.index}]神奇矿山成功收取${result.result.gainOre}矿石`)
        } else {
            console.log(`账号[${this.index}]神奇矿山收取矿石失败: ${result.message}`)
        }
    }
    
    async miningEnroll() {
        let url = `https://magicisland.58.com/web/mining/enroll`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            console.log(`账号[${this.index}]神奇矿山召唤小帮手成功`)
        } else {
            console.log(`账号[${this.index}]神奇矿山召唤小帮手失败: ${result.message}`)
        }
    }
    
    async auctionInfo() {
        let url = `https://magicisland.58.com/web/auction/second`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        urlObject.headers.Referer = 'https://magicisland.58.com/web/v/lowauctiondetail'
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            this.auction.status = result.result.bidInfo.bidStatus
            let auctionStr = (this.auction.status==0) ? '未参与竞拍' : '已参与竞拍'
            console.log(`账号[${this.index}]今天${auctionStr}`)
            let maxBid = parseFloat(result.result.userInfo.usableOre)
            let bidNum = 1
            if(this.runTask == 1) {
                if(this.auction.status==0) {
                    if(maxBid >= bidNum) {
                        await $.wait(500)
                        await this.auctionBid(bidNum)
                    } else {
                        console.log(`账号[${this.index}]可用矿石余额${maxBid}不足，不能竞拍出价${bidNum}矿石`)
                    }
                } else if(this.auction.status==1) {
                    let lastBid = parseInt(result.result.bidInfo.bidOre)
                    bidNum = (lastBid)%3 + 1
                    if(maxBid >= bidNum) {
                        await $.wait(500)
                        await this.auctionModify(bidNum,result.result.bidInfo.auctionNumber)
                    } else {
                        console.log(`账号[${this.index}]可用矿石余额${maxBid}不足，不能竞拍出价${bidNum}矿石`)
                    }
                }
            }
        } else {
            console.log(`账号[${this.index}]查询低价竞拍主页失败: ${result.message}`)
        }
    }
    
    async auctionBid(prize) {
        let url = `https://magicisland.58.com/web/auction/bid`
        let body = `ore=${prize}`
        let urlObject = populateUrlObject(url,this.cookie,body)
        urlObject.headers.Referer = 'https://magicisland.58.com/web/v/lowauctiondetail'
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            console.log(`账号[${this.index}]竞拍出价${prize}矿石成功`)
        } else {
            console.log(`账号[${this.index}]竞拍出价${prize}矿石失败: ${result.message}`)
        }
    }
    
    async auctionModify(prize,number) {
        let url = `https://magicisland.58.com/web/auction/modify`
        let body = `ore=${prize}&number=${number}`
        let urlObject = populateUrlObject(url,this.cookie,body)
        urlObject.headers.Referer = 'https://magicisland.58.com/web/v/lowauctiondetail'
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            console.log(`账号[${this.index}]竞拍改价${prize}矿石成功`)
        } else {
            console.log(`账号[${this.index}]竞拍改价${prize}矿石失败: ${result.message}`)
        }
    }
    
    async oreGameScore() {
        let url = `https://magicisland.58.com/web/mineral/gameprocessore`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            console.log(`账号[${this.index}]领取游戏完成奖励成功`)
        } else {
            console.log(`账号[${this.index}]领取游戏完成奖励失败: ${result.message}`)
        }
    }
    
    async attendanceDetail() {
        let url = `https://magicisland.58.com/web/attendance/detail/info?productorid=3`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            let attendList = ''
            console.log(`账号[${this.index}]今天打卡状态:`)
            for(let item of result.result.infoList) {
                let type = attendType[item.type]
                let str = (item.userState==0) ? '未报名' : ((item.userState==5) ? '可打卡' :'已报名')
                console.log(`账号[${this.index}]${type}${item.number}期 -- ${str}`)
                if(item.userState==0) {
                    if(this.runTask == 1) {
                        if(this.ore.ore >= item.oreLimitValue) {
                            await $.wait(500)
                            await this.attendanceSignIn(item)
                        } else {
                            console.log(`账号[${this.index}]矿石余额${this.ore.ore}不足，不能花费${item.oreLimitValue}矿石报名${type}${item.number}期打卡`)
                        }
                    }
                } else if (item.userState==5) {
                    let numType = (item.type=='multiDay') ? 'numberMany' : 'number'
                    attendList += `&${numType}=${item.number}`
                }
            }
            if(attendList) {
                await $.wait(500)
                await this.attendanceAttend(attendList)
            }
        } else {
            console.log(`账号[${this.index}]查询打卡状态失败: ${result.message}`)
        }
    }
    
    async attendanceSignIn(item) {
        let type = attendType[item.type]
        let url = `https://magicisland.58.com/web/attendance/signIn`
        let body = `number=${item.number}&category=${item.type}&productorid=3`
        let urlObject = populateUrlObject(url,this.cookie,body)
        urlObject.headers.Referer = 'https://magicisland.58.com/web/v/client'
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            console.log(`账号[${this.index}]报名${type}${item.number}期成功，预计可获得${result.result.averageRewardOre}矿石`)
        } else {
            console.log(`账号[${this.index}]报名${type}${item.number}期失败: ${result.message}`)
        }
    }
    
    async attendanceAttend(attendList) {
        let url = `https://magicisland.58.com/web/attendance/attend`
        let body = `productorid=3${attendList}`
        let urlObject = populateUrlObject(url,this.cookie,body)
        urlObject.headers.Referer = 'https://magicisland.58.com/web/v/client'
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            console.log(`账号[${this.index}]打卡成功`)
        } else {
            console.log(`账号[${this.index}]打卡失败: ${result.message}`)
        }
    }
    
    async cashSigninlist() {
        let url = `https://tzbl.58.com/tzbl/taskcenter/signinlist?requestSource=1`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            this.cashSign = result.data.signInVO.status==2 ? true : false
            let cashStr = this.cashSign ? '未签到' : '已签到'
            console.log(`账号[${this.index}]今日现金签到页: ${cashStr}`)
        } else {
            console.log(`账号[${this.index}]查询现金签到失败: ${result.message}`)
        }
    }
    
    async cashSignin() {
        let url = `https://tzbl.58.com/tzbl/taskcenter/signin?requestSource=1`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            console.log(`账号[${this.index}]现金签到获得${result.data.amount}元`)
        } else {
            console.log(`账号[${this.index}]查询现金签到失败: ${result.message}`)
        }
    }

    // 梦想小镇大富翁 - 前进
    async rolldice() {
        const usableTimes = this.maininfo?.monopolyInfo?.usableTimes || 0;
        if (!usableTimes || usableTimes == '0') {
            console.log(`账号[${this.index}]梦想小镇大富翁游戏机会已用完`);
            return;
        }
        console.log(`账号[${this.index}]梦想小镇大富翁游戏有${this.maininfo.monopolyInfo.usableTimes}次机会`);

        let url = `https://dreamtown.58.com/web/dreamtown/monopoly/rolldice`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            const award = result.result.award;
            if (award.type === null) { // 已经到账
                if (award.category === 1) {
                    console.log(`账号[${this.index}]获取到: ${award.data}个金币`)
                }
                if (award.category === 3) {
                    console.log(`账号[${this.index}]获取到: ${award.data}体力`)
                }
            } else if (award.type === 'task') { // 做任务
                const sceneId = 2;
                const taskId = award.data;
                await $.wait(500);
                // 做任务
                await this.doTask(sceneId, taskId);
                await $.wait(200);
                // 领取任务奖励
                await this.getReward(sceneId, taskId); 
            } else if (award.type === 'coin') { // 做任务
                console.log('todo: 需要做任务coin')
            } else if (award.type === 'speed') { // 1次免广告加速机会
                console.log(`账号[${this.index}]获得1次免广告加速机会`)
            } else if (award.type === 'less' || award.type === 'more') {
                // less:获得少量金币 more:获得大量金币
                console.log(`账号[${this.index}]获得: ${award.data}个金币`)
            }
            
            this.maininfo.monopolyInfo.usableTimes = result.result.timesInfo.usableTimes;
            
            if (this.maininfo.monopolyInfo.usableTimes) {
                await $.wait(500);
                await this.rolldice();
            }
        } else {
            console.log(`账号[${this.index}]查询梦想小镇大富翁详情失败: ${result.message}`)
        }
    }

    // 梦想小镇-加速建筑
    async speedUp() {
        if (!this.maininfo.speedInfo.speedTimes) {
            console.log(`账号[${this.index}]可加速次数为0`);
            return
        }
        if (this.maininfo.speedInfo.expireTime != 0) {
            console.log(`账号[${this.index}]加速效果还未失效`);
            return
        }
        // 免广告加速
        let url = `https://dreamtown.58.com/web/dreamtown/speed`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            console.log(`账号[${this.index}]${this.buildstr}加速成功`);
        } else {
            console.log(`账号[${this.index}]${this.buildstr}加速失败: ${result.message}`)
        }
    }

    // 合成房子任务
    async doCompoundTask () {
        // 获取基本信息
        await this.dreamTownmainInfo(this.compoundType);
        // 判断时候完成游戏引导
        if (!this.maininfo?.levelInfo?.house) {
            console.log(`账号[${this.index}]我的房子没有初始化，跳过`);
            return;
        }
        await $.wait(200);
        // 防止递归死循环
        if (this.compoundHouse < this.canCompoundHouse) {
            // 查询可以合成的地块
            const info = this.compoundInfo();
            // 不可合成
            if (!info.flag) {
                const empty = this.getEmpty();
                // 有空地
                if (empty) {
                    // 有系统赠送
                    if (this.maininfo.fallDown && empty > 1) {
                        // 获取系统赠送
                        if (await this.falldown()) {
                            await $.wait(2000)
                            // 合成任务
                            await this.doCompoundTask();
                        }
                    } else {
                        // 购买
                        await this.buyBuild();
                    }
                } else {
                    // 只能连续卖一次
                    if (this.sellBuildNum >= 1) return;
                    // 无可合成且无空地，卖掉一个
                    console.log(`账号[${this.index}]没有可合成地块,也没有空地，卖掉等级最低的！`);
                    // 查询等级最低的地块
                    const minInfo = this.findMin();
                    let sellIndex = minInfo[0].locationIndex;
                    if (minInfo.length > 1) {
                        const coins = Number(this.maininfo.userInfo.coin);
                        const elements = await this.getDreamtownStore();
                        const second = elements.filter(x=>{
                            return x.level == minInfo[1].level
                        });
                        const price = Number(second[0].price);
                        if (coins < price) {
                            this.waitTime = parseInt((price - coins) / this.maininfo.userInfo.coinSpeed) * 1000;
                            if (this.waitTime <= 20000) {
                                console.log(`账号[${this.index}]等待${this.waitTime / 1000}s`);
                                await $.wait(this.waitTime);
                            } else if (this.waitTime > 20000) {
                                console.log(`账号[${this.index}]不等待，直接卖掉`);
                            } else {
                                console.log(`账号[${this.index}]需等待${this.waitTime/1000}s，换下一个账号`);
                                return;
                            }
                        }
                    } 
                    // 售卖
                    await this.sellBuild(sellIndex);
                    this.sellBuildNum++;
                    await $.wait(200);
                    await this.doCompoundTask();
                }
            } else {
                // 可合成
                await $.wait(200);
                // 合成
                await this.compound(info);
                // 购买次数归零
                this.sellBuildNum = 0;
                // 记录合成次数，防止递归死循环
                this.compoundHouse++;
                // 递归合成任务
                await this.doCompoundTask();
            }
        } else {
            console.log(`账号[${this.index}]本次合成任务已完成，换下一个账号`);
        }
    }
    // 梦想小镇-合成建筑
    async compound(info) {
        let url = `https://dreamtown.58.com/web/dreamtown/compound`
        let body = `fromId=${info.fromId}&toId=${info.toId}`
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            console.log(`账号[${this.index}]地块${info.fromId}合向地块${info.toId}， 地块${info.toId}升级到${info.level+1}级`);

            // 做任务领奖励
            const sceneId = 6;
            const taskId = result.result.itemId;
            if (taskId) {
                console.log(`账号[${this.index}]合成地块触发合成奖励`);
                await $.wait(25000);
                // 做任务
                await this.doTask(sceneId, taskId);
                await $.wait(200);
                // 领取任务奖励
                await this.getReward(sceneId, taskId);
                console.log(`账号[${this.index}]合成地块${info.toId}后做任务获取奖励`);
            }
        } else {
            console.log(`账号[${this.index}]合成失败: ${result.message}`)
        }
    }

    // 获取系统赠送成
    async falldown () {
        // 查询空地
        const empty = this.getEmpty();
        if (empty) {
            let url = `https://dreamtown.58.com/web/dreamtown/falldown`
            let body = ``
            let urlObject = populateUrlObject(url,this.cookie,body)
            await httpRequest('get',urlObject)
            let result = httpResult;
            if(!result) return
            if(result.code == 0) {
                console.log(`账号[${this.index}]获取系统赠送的${result?.result?.level}级物品`);
                return true;
            } else {
                console.log(`账号[${this.index}]获取系统赠送失败: ${result.message}`);
                return false;
            }
        }
    }

    // 查询梦想小镇大富翁详情
    async dreamTownmainInfo(target) {
        let url = `https://dreamtown.58.com/web/dreamtown/maininfo?initialization=1`;
        let body = ``;
        try{ck=this.cookie;}catch{};
        let urlObject = populateUrlObject(url,this.cookie,body);
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            this.maininfo = result.result;

            // 房子信息
            if (target === 'house' && !this.showHouse) {
                this.showHouse = true;
                console.log(`账号[${this.index}]房子${this.maininfo?.levelInfo?.house}级，30级可领30元。`)
            }

            // 车信息
            if (target === 'car' && !this.showCar) {
                this.showCar = true;
                console.log(`账号[${this.index}]车子${this.maininfo.levelInfo.car}级`)
                console.log(`账号[${this.index}]车子领取规则：`)
                console.log(`车子合成到12级：领取0.2元`)
                console.log(`车子合成到20级：领取5元`)
                console.log(`车子合成到30级：领取8元`)
                console.log(`车子合成到40级：领取15元`)
                console.log(`车子合成到50级：领取60元`)
            }

            // 检查宝箱
            for (const key in this.maininfo.locationInfo) {
                if (this.maininfo.locationInfo[key] && this.maininfo.locationInfo[key].state === 1) {
                    await $.wait(200);
                    await this.openJewellery(this.maininfo.locationInfo[key].locationIndex);
                }
            }
        } else {
            console.log(`账号[${this.index}]查询梦想小镇大富翁详情失败: ${result.message}`)
        }
    }

    // 开宝箱
    async openJewellery (locationIndex) {
        let url = `https://dreamtown.58.com/web/dreamtown/open`
        let body = `locationIndex=${locationIndex}`
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            console.log(`账号[${this.index}]开宝箱获得：${result.result.name}`);
        } else {
            console.log(`账号[${this.index}]开宝箱失败: ${result.message}`)
        }
    }

    // 获取合成信息
    compoundInfo() {
        const locationInfo = this.maininfo.locationInfo;
        let result = {flag: false};
        const tempInfo = {};
        for (let key in locationInfo) {
            if (locationInfo[key]) {
                if (!tempInfo[locationInfo[key].level]) {
                    tempInfo[locationInfo[key].level] = [];
                }
                tempInfo[locationInfo[key].level].push(locationInfo[key]);
            }
        }
        for (let key in tempInfo) { 
            if (tempInfo[key].length >=  2) {
                result = {
                    flag: tempInfo[key][0].locationIndex == tempInfo[key][1].locationIndex ? false : true,
                    fromId: tempInfo[key][0].locationIndex,
                    toId: tempInfo[key][1].locationIndex,
                    level: tempInfo[key][0].level,
                }
                return result;
            }
        }
        return result;
    }
    // 梦想小镇-售卖
    async sellBuild(locationIndex) {
        let url = `https://dreamtown.58.com/web/dreamtown/sell`
        let body = `locationIndex=${locationIndex}`
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            console.log(`账号[${this.index}]售卖成功`)
        } else {
            console.log(`账号[${this.index}]售卖失败: ${result.message}`)
        }
    }
    // 查找等级最低的
    findMin() {
        const locationInfo = this.maininfo.locationInfo;
        let result = [];
        const tempInfo = {};
        for (let key in locationInfo) {
            if (locationInfo[key]) {
                if (!tempInfo[locationInfo[key].level]) {
                    tempInfo[locationInfo[key].level] = [];
                }
                tempInfo[locationInfo[key].level].push(locationInfo[key]);
            }
        }
        if (Object.keys(tempInfo).length == 12) {
            return [tempInfo[Object.keys(tempInfo)[0]][0], tempInfo[Object.keys(tempInfo)[1]][0]]
        }
        for (let key in tempInfo) { 
            if (tempInfo[key] && tempInfo[key].length == 1) {
                return [tempInfo[key][0]];
            }
        }
        return result;
    }
    // 查询空地
    getEmpty() {
        let empty = 0;
        for (const key in this.maininfo.locationInfo) {
            if (this.maininfo.locationInfo[key] === null) {
                empty+=1;
            }
        }
        return empty;
    }
    // 梦想小镇-获取商店信息
    async getDreamtownStore () {
        let url = `https://dreamtown.58.com/web/dreamtown/store`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        if(result.code == 0) {
            const elements = result.result.elements || [];
            return elements;
        } else {
            return [];
        }
    }
    // 梦想小镇-普通购买建筑
    async buyBuild() {
        const coins = Number(this.maininfo.userInfo.coin);
        const elements = await this.getDreamtownStore();
        
        const canBuy = elements.filter(x=>{
            return x.lockState === 2 && Number(x.price) <= coins;
        })
        if (!canBuy.length) {
            console.log(`账号[${this.index}]钱不够，等待30s`);
            await $.wait(30 * 1000)
            await this.doCompoundTask();
            return;
        }
        const level = canBuy[canBuy.length-1].level || 1;
        if (!level) {
            console.log(`账号[${this.index}]购买失败：购买${this.buildstr}等级未知`)
            return;
        }
        const tempLavel = this.maininfo.levelInfo[this.compoundType] || 0;
        const minLevel = Math.floor(tempLavel/2)-2 ? Math.floor(tempLavel/2)-1 : 1;
        if (level < minLevel) {
            console.log(`账号[${this.index}]当前能购买的${this.buildstr}等级过低，结束`);
            return;
        }

        let url = `https://dreamtown.58.com/web/dreamtown/buy`
        let body = `type=store&level=${level}`
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log('购买结果：',JSON.stringify(result))
        if(result.code == 0) {
            if (result.result.state === 0) {
                console.log(`账号[${this.index}]购买${level}级${this.buildstr}`)
                await $.wait(100);
                await this.doCompoundTask();
            } else {
                console.log('购买结果：',JSON.stringify(result));
                if (result.result.message == '位置已满！合并或拖到左下角出售') {
                    await $.wait(100);
                    await this.doCompoundTask();
                } else {
                    console.log(`账号[${this.index}]购买失败: ${result.result.message}`);
                }
            }
        } else {
            console.log(`账号[${this.index}]购买失败: ${result.message}`);
        }
    }

    // 梦想小镇-房子/车子场景切换
    async dreamTownSwitch(target) {
        let url = `https://dreamtown.58.com/web/dreamtown/switch`
        let body = `target=${target}`
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        const names = {
            1: '我的房子',
            2: '我的车子',
        }
        if(result.code == 0) {
            console.log(`账号[${this.index}]场景切换到梦想小镇${names[target]}`)
            this.compoundType = target == 1 ? 'house' : 'car'
            this.buildstr = target == 1 ? '建筑' : '车子'
        } else {
            console.log(`账号[${this.index}]场景切换到梦想小镇${names[target]}失败: ${result.message}`)
        }
    }
}

!(async () => {
    if (typeof $request !== "undefined") {
        await GetRewrite()
    }else {
        if(!(await checkEnv())) return
        console.log('====================\n')
        console.log(`如果要自定义UA，请把UA填到wbtcUA里，现在使用的UA是：\n${userUA}`)
        
        // console.log('\n================== 现金签到 ==================')
        // for(let user of userList) {
        //     await user.cashSigninlist(); 
        //     await $.wait(200);
        // }
        
        // for(let user of userList.filter(x => x.cashSign)) {
        //     await user.cashSignin(); 
        //     await $.wait(200);
        // }
        
        // console.log('\n================== 矿山小游戏 ==================')
        // for(let user of userList) {
        //     await user.miningUserInfo(); 
        //     await $.wait(200);
        // }
        
        // console.log('\n================== 竞拍小游戏 ==================')
        // for(let user of userList) {
        //     await user.auctionInfo(); 
        //     await $.wait(200);
        // }
        
        // console.log('\n================== 打卡小游戏 ==================')
        // for(let user of userList) {
        //     await user.oreMainpage(false); 
        //     await $.wait(200);
        // }
        
        // for(let user of userList) {
        //     await user.attendanceDetail(); 
        //     await $.wait(200);
        // }
        
        // console.log('\n================== 金币任务 ==================')
        // if(curHour>=TASK_TIME[0] && curHour<TASK_TIME[1]) {
        //     console.log('\n查询任务...')
        //     for(let id of taskList) {
        //         for(let user of userList) {
        //             await user.getTaskList(id); 
        //             await $.wait(200);
        //         }
        //     }
            
        //     for(let user of userList) {
        //         maxTaskLen = getMax(user.task.length,maxTaskLen)
        //         maxRewardLen = getMax(user.reward.length,maxRewardLen)
        //     }
            
        //     console.log('\n完成任务...')
        //     for(let i=0; i<maxTaskLen; i++) {
        //         for(let user of userList.filter(x => i<x.task.length)) {
        //             let item = user.task[i]
        //             await user.doTask(item.sceneId,item.taskId); 
        //             await $.wait(200);
        //             await user.getReward(item.sceneId,item.taskId); 
        //             await $.wait(200);
        //         }
        //         await $.wait(15000);
        //     }
            
        //     console.log('\n领取奖励...')
        //     for(let i=0; i<maxRewardLen; i++) {
        //         for(let user of userList.filter(x => i<x.reward.length)) {
        //             let item = user.reward[i]
        //             await user.getReward(item.sceneId,item.taskId); 
        //             await $.wait(200);
        //         }
        //         await $.wait(500);
        //     } 
        // } else {
        //     console.log(`${TASK_TIME[0]}点到${TASK_TIME[1]}点之间会做金币任务`)
        // }
        
        // console.log('\n================== 新手奖励 ==================')
        // for(let user of userList) {
        //     await user.newbieMaininfo(); 
        //     await $.wait(200);
        // }
        
        // console.log('\n================== 我的家奖励 ==================')
        // for(let user of userList) {
        //     await user.houseSignStatus(); 
        //     await $.wait(200);
        // }
        
        // for(let user of userList) {
        //     await user.houseWithdrawPage(); 
        //     await $.wait(200);
        // }

        console.log('\n================== 梦想小镇-大富翁-合成房子 ==================')
        for(let user of userList) {
            // await $.wait(delay()); //  随机延时
            await user.dreamTownmainInfo(); 
            await $.waits(200);

            // 抛色子
            // await user.rolldice(); 
            // await $.wait(200);

            // if (user.maininfo?.speedInfo?.speedTimes) {
            //     // 免广告加速
            //     if (user.maininfo?.speedInfo?.monopolyAwardSpeedTimes) {
            //         await user.speedUp(); 
            //         await $.wait(200);
            //     } else {
            //         // todo: 看广告加速
            //     }
            // }

            // // 我的房
            // await user.dreamTownSwitch(1);
            // await $.wait(200);
            // // 开始合成房子任务
            // await user.doCompoundTask();
            // await $.wait(200);

            // // 我的车
            // if (user.maininfo?.levelInfo?.car) {
            //     user.canCompoundHouse = 100;
            //     await user.dreamTownSwitch(2);
            //     await $.wait(200);
            //     // 开始合成车子任务
            //     await user.doCompoundTask();
            //     await $.wait(200);

            //     if (Number(user.maininfo.levelInfo.house) > Number(user.maininfo.levelInfo.car)) {
            //         console.log('切回我的房子')
            //         await user.dreamTownSwitch(1); 
            //     }
            // }
        }
        
        console.log('\n================== 查询账户 ==================')
        for(let user of userList) {
            await user.oreMainpage(true); 
            await $.wait(200);
        }
        
    }
})()
.catch((e) => $.logErr(e))
.finally(() => $.done())

///////////////////////////////////////////////////////////////////
async function checkEnv() {
    if(userCookie) {
        for(let userCookies of userCookie.split('@')) {
            if(userCookies) userList.push(new UserInfo(userCookies))
        }
        userCount = userList.length
    } else {
        console.log('未找到wbtcCookie')
        return;
    }
    
    console.log(`共找到${userCount}个账号`)
    return true
}

async function GetRewrite() {
    if($request.url.indexOf('getIndexSignInInfo') > -1) {
        let ppu = $request.headers.ppu ? $request.headers.ppu : $request.headers.PPU
        if(!ppu) return;
        let uid = ppu.match(/UID=(\w+)/)[1]
        ck = 'PPU=' + ppu
        
        if(userCookie) {
            if(userCookie.indexOf('UID='+uid) == -1) {
                userCookie = userCookie + '@' + ck
                $.setdata(userCookie, 'wbtcCookie');
                ckList = userCookie.split('@')
                $.msg(jsname+` 获取第${ckList.length}个wbtcCookie成功: ${ck}`)
            } else {
                console.log(jsname+` 找到重复的wbtcCookie，准备替换: ${ck}`)
                ckList = userCookie.split('@')
                for(let i=0; i<ckList.length; i++) {
                    if(ckList[i].indexOf('UID='+uid) > -1) {
                        ckList[i] = ck
                        break;
                    }
                }
                userCookie = ckList.join('@')
                $.setdata(userCookie, 'wbtcCookie');
            }
        } else {
            $.setdata(ck, 'wbtcCookie');
            $.msg(jsname+` 获取第1个wbtcCookie成功: ${ck}`)
        }
    }
}

//通知
async function showmsg() {
    if(!notifyStr) return
    notifyBody = jsname + "运行通知\n\n" + notifyStr
    if (notifyFlag == 1) {
        $.msg(notifyBody);
        if($.isNode()){await notify.sendNotify($.name, notifyBody );}
    } else {
        console.log(notifyBody);
    }
}
////////////////////////////////////////////////////////////////////
function populateUrlObject(url,cookie,body=''){
    let host = (url.split('//')[1]).split('/')[0]
    let urlObject = {
        url: url,
        headers: {
            'Host' : host,
            'Cookie' : cookie,
            'Connection' : 'keep-alive',
            'Accept' : 'application/json, text/plain, */*',
            'User-Agent' : userUA,
            'Accept-Language' : 'zh-CN,zh-Hans;q=0.9',
            'Accept-Encoding' : 'gzip, deflate, br',
        },
    }
    if(body) urlObject.body = body
    return urlObject;
}

async function httpRequest(method,url) {
    httpResult = null
    if(method == 'post') {
        url.headers['Content-Type'] =  'application/x-www-form-urlencoded'
        if(url.body) {
            url.headers['Content-Length'] = url.body.length
        } else {
            url.headers['Content-Length'] = 0
        }
    }
    return new Promise((resolve) => {
        $[method](url, async (err, resp, data) => {
            try {
                if (err) {
                    console.log(`${method}请求失败`);
                    console.log(JSON.stringify(err));
                    $.logErr(err);
                } else {
                    if (safeGet(data)) {
                        httpResult = JSON.parse(data);
                        if(logDebug) console.log(httpResult);
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve();
            }
        });
    });
}

function safeGet(data) {
    try {
        if (typeof JSON.parse(data) == "object") {
            return true;
        } else {
            console.log(data)
        }
    } catch (e) {
        console.log(e);
        console.log(`服务器访问数据为空，请检查自身设备网络情况`);
        return false;
    }
}

function getMin(a,b){
    return ((a<b) ? a : b)
}

function getMax(a,b){
    return ((a<b) ? b : a)
}

function delay () {
    let time = parseInt(Math.random()*100000);
    if (time > 30000) {// 大于30s重新生成
        return delay();
    } else{
        console.log('随机延时：', `${time}ms, 避免大家运行时间一样`)
        return time;// 小于30s，返回
    }
}

function padStr(num,length,padding='0') {
    let numStr = String(num)
    let numPad = (length>numStr.length) ? (length-numStr.length) : 0
    let retStr = ''
    for(let i=0; i<numPad; i++) {
        retStr += padding
    }
    retStr += numStr
    return retStr;
}

function randomString(len=12) {
    let chars = 'abcdef0123456789';
    let maxLen = chars.length;
    let str = '';
    for (i = 0; i < len; i++) {
        str += chars.charAt(Math.floor(Math.random()*maxLen));
    }
    return str;
}
    
var Base64={_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encode:function(e){var t="";var n,r,i,s,o,u,a;var f=0;e=Base64._utf8_encode(e);while(f<e.length){n=e.charCodeAt(f++);r=e.charCodeAt(f++);i=e.charCodeAt(f++);s=n>>2;o=(n&3)<<4|r>>4;u=(r&15)<<2|i>>6;a=i&63;if(isNaN(r)){u=a=64}else if(isNaN(i)){a=64}t=t+this._keyStr.charAt(s)+this._keyStr.charAt(o)+this._keyStr.charAt(u)+this._keyStr.charAt(a)}return t},decode:function(e){var t="";var n,r,i;var s,o,u,a;var f=0;e=e.replace(/[^A-Za-z0-9+/=]/g,"");while(f<e.length){s=this._keyStr.indexOf(e.charAt(f++));o=this._keyStr.indexOf(e.charAt(f++));u=this._keyStr.indexOf(e.charAt(f++));a=this._keyStr.indexOf(e.charAt(f++));n=s<<2|o>>4;r=(o&15)<<4|u>>2;i=(u&3)<<6|a;t=t+String.fromCharCode(n);if(u!=64){t=t+String.fromCharCode(r)}if(a!=64){t=t+String.fromCharCode(i)}}t=Base64._utf8_decode(t);return t},_utf8_encode:function(e){e=e.replace(/rn/g,"n");var t="";for(var n=0;n<e.length;n++){var r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r)}else if(r>127&&r<2048){t+=String.fromCharCode(r>>6|192);t+=String.fromCharCode(r&63|128)}else{t+=String.fromCharCode(r>>12|224);t+=String.fromCharCode(r>>6&63|128);t+=String.fromCharCode(r&63|128)}}return t},_utf8_decode:function(e){var t="";var n=0;var r=c1=c2=0;while(n<e.length){r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r);n++}else if(r>191&&r<224){c2=e.charCodeAt(n+1);t+=String.fromCharCode((r&31)<<6|c2&63);n+=2}else{c2=e.charCodeAt(n+1);c3=e.charCodeAt(n+2);t+=String.fromCharCode((r&15)<<12|(c2&63)<<6|c3&63);n+=3}}return t}}

function MD5Encrypt(a){function b(a,b){return a<<b|a>>>32-b}function c(a,b){var c,d,e,f,g;return e=2147483648&a,f=2147483648&b,c=1073741824&a,d=1073741824&b,g=(1073741823&a)+(1073741823&b),c&d?2147483648^g^e^f:c|d?1073741824&g?3221225472^g^e^f:1073741824^g^e^f:g^e^f}function d(a,b,c){return a&b|~a&c}function e(a,b,c){return a&c|b&~c}function f(a,b,c){return a^b^c}function g(a,b,c){return b^(a|~c)}function h(a,e,f,g,h,i,j){return a=c(a,c(c(d(e,f,g),h),j)),c(b(a,i),e)}function i(a,d,f,g,h,i,j){return a=c(a,c(c(e(d,f,g),h),j)),c(b(a,i),d)}function j(a,d,e,g,h,i,j){return a=c(a,c(c(f(d,e,g),h),j)),c(b(a,i),d)}function k(a,d,e,f,h,i,j){return a=c(a,c(c(g(d,e,f),h),j)),c(b(a,i),d)}function l(a){for(var b,c=a.length,d=c+8,e=(d-d%64)/64,f=16*(e+1),g=new Array(f-1),h=0,i=0;c>i;)b=(i-i%4)/4,h=i%4*8,g[b]=g[b]|a.charCodeAt(i)<<h,i++;return b=(i-i%4)/4,h=i%4*8,g[b]=g[b]|128<<h,g[f-2]=c<<3,g[f-1]=c>>>29,g}function m(a){var b,c,d="",e="";for(c=0;3>=c;c++)b=a>>>8*c&255,e="0"+b.toString(16),d+=e.substr(e.length-2,2);return d}function n(a){a=a.replace(/\r\n/g,"\n");for(var b="",c=0;c<a.length;c++){var d=a.charCodeAt(c);128>d?b+=String.fromCharCode(d):d>127&&2048>d?(b+=String.fromCharCode(d>>6|192),b+=String.fromCharCode(63&d|128)):(b+=String.fromCharCode(d>>12|224),b+=String.fromCharCode(d>>6&63|128),b+=String.fromCharCode(63&d|128))}return b}var o,p,q,r,s,t,u,v,w,x=[],y=7,z=12,A=17,B=22,C=5,D=9,E=14,F=20,G=4,H=11,I=16,J=23,K=6,L=10,M=15,N=21;for(a=n(a),x=l(a),t=1732584193,u=4023233417,v=2562383102,w=271733878,o=0;o<x.length;o+=16)p=t,q=u,r=v,s=w,t=h(t,u,v,w,x[o+0],y,3614090360),w=h(w,t,u,v,x[o+1],z,3905402710),v=h(v,w,t,u,x[o+2],A,606105819),u=h(u,v,w,t,x[o+3],B,3250441966),t=h(t,u,v,w,x[o+4],y,4118548399),w=h(w,t,u,v,x[o+5],z,1200080426),v=h(v,w,t,u,x[o+6],A,2821735955),u=h(u,v,w,t,x[o+7],B,4249261313),t=h(t,u,v,w,x[o+8],y,1770035416),w=h(w,t,u,v,x[o+9],z,2336552879),v=h(v,w,t,u,x[o+10],A,4294925233),u=h(u,v,w,t,x[o+11],B,2304563134),t=h(t,u,v,w,x[o+12],y,1804603682),w=h(w,t,u,v,x[o+13],z,4254626195),v=h(v,w,t,u,x[o+14],A,2792965006),u=h(u,v,w,t,x[o+15],B,1236535329),t=i(t,u,v,w,x[o+1],C,4129170786),w=i(w,t,u,v,x[o+6],D,3225465664),v=i(v,w,t,u,x[o+11],E,643717713),u=i(u,v,w,t,x[o+0],F,3921069994),t=i(t,u,v,w,x[o+5],C,3593408605),w=i(w,t,u,v,x[o+10],D,38016083),v=i(v,w,t,u,x[o+15],E,3634488961),u=i(u,v,w,t,x[o+4],F,3889429448),t=i(t,u,v,w,x[o+9],C,568446438),w=i(w,t,u,v,x[o+14],D,3275163606),v=i(v,w,t,u,x[o+3],E,4107603335),u=i(u,v,w,t,x[o+8],F,1163531501),t=i(t,u,v,w,x[o+13],C,2850285829),w=i(w,t,u,v,x[o+2],D,4243563512),v=i(v,w,t,u,x[o+7],E,1735328473),u=i(u,v,w,t,x[o+12],F,2368359562),t=j(t,u,v,w,x[o+5],G,4294588738),w=j(w,t,u,v,x[o+8],H,2272392833),v=j(v,w,t,u,x[o+11],I,1839030562),u=j(u,v,w,t,x[o+14],J,4259657740),t=j(t,u,v,w,x[o+1],G,2763975236),w=j(w,t,u,v,x[o+4],H,1272893353),v=j(v,w,t,u,x[o+7],I,4139469664),u=j(u,v,w,t,x[o+10],J,3200236656),t=j(t,u,v,w,x[o+13],G,681279174),w=j(w,t,u,v,x[o+0],H,3936430074),v=j(v,w,t,u,x[o+3],I,3572445317),u=j(u,v,w,t,x[o+6],J,76029189),t=j(t,u,v,w,x[o+9],G,3654602809),w=j(w,t,u,v,x[o+12],H,3873151461),v=j(v,w,t,u,x[o+15],I,530742520),u=j(u,v,w,t,x[o+2],J,3299628645),t=k(t,u,v,w,x[o+0],K,4096336452),w=k(w,t,u,v,x[o+7],L,1126891415),v=k(v,w,t,u,x[o+14],M,2878612391),u=k(u,v,w,t,x[o+5],N,4237533241),t=k(t,u,v,w,x[o+12],K,1700485571),w=k(w,t,u,v,x[o+3],L,2399980690),v=k(v,w,t,u,x[o+10],M,4293915773),u=k(u,v,w,t,x[o+1],N,2240044497),t=k(t,u,v,w,x[o+8],K,1873313359),w=k(w,t,u,v,x[o+15],L,4264355552),v=k(v,w,t,u,x[o+6],M,2734768916),u=k(u,v,w,t,x[o+13],N,1309151649),t=k(t,u,v,w,x[o+4],K,4149444226),w=k(w,t,u,v,x[o+11],L,3174756917),v=k(v,w,t,u,x[o+2],M,718787259),u=k(u,v,w,t,x[o+9],N,3951481745),t=c(t,p),u=c(u,q),v=c(v,r),w=c(w,s);var O=m(t)+m(u)+m(v)+m(w);return O.toLowerCase()}

function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);var Base64={_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encode:function(e){var t="";var n,r,i,s,o,u,a;var f=0;e=Base64._utf8_encode(e);while(f<e.length){n=e.charCodeAt(f++);r=e.charCodeAt(f++);i=e.charCodeAt(f++);s=n>>2;o=(n&3)<<4|r>>4;u=(r&15)<<2|i>>6;a=i&63;if(isNaN(r)){u=a=64}else if(isNaN(i)){a=64}t=t+this._keyStr.charAt(s)+this._keyStr.charAt(o)+this._keyStr.charAt(u)+this._keyStr.charAt(a)}return t},decode:function(e){var t="";var n,r,i;var s,o,u,a;var f=0;e=e.replace(/[^A-Za-z0-9+/=]/g,"");while(f<e.length){s=this._keyStr.indexOf(e.charAt(f++));o=this._keyStr.indexOf(e.charAt(f++));u=this._keyStr.indexOf(e.charAt(f++));a=this._keyStr.indexOf(e.charAt(f++));n=s<<2|o>>4;r=(o&15)<<4|u>>2;i=(u&3)<<6|a;t=t+String.fromCharCode(n);if(u!=64){t=t+String.fromCharCode(r)}if(a!=64){t=t+String.fromCharCode(i)}}t=Base64._utf8_decode(t);return t},_utf8_encode:function(e){e=e.replace(/rn/g,"n");var t="";for(var n=0;n<e.length;n++){var r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r)}else if(r>127&&r<2048){t+=String.fromCharCode(r>>6|192);t+=String.fromCharCode(r&63|128)}else{t+=String.fromCharCode(r>>12|224);t+=String.fromCharCode(r>>6&63|128);t+=String.fromCharCode(r&63|128)}}return t},_utf8_decode:function(e){var t="";var n=0;var r=c1=c2=0;while(n<e.length){r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r);n++}else if(r>191&&r<224){c2=e.charCodeAt(n+1);t+=String.fromCharCode((r&31)<<6|c2&63);n+=2}else{c2=e.charCodeAt(n+1);c3=e.charCodeAt(n+2);t+=String.fromCharCode((r&15)<<12|(c2&63)<<6|c3&63);n+=3}}return t}};class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),"PUT"===e&&(s=this.put),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}put(t){return this.send.call(this.env,t,"PUT")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`\ud83d\udd14${this.name}, \u5f00\u59cb!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),a={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(a,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.post(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method="POST",this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:s,...i}=t;this.got.post(s,i).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}put(t,e=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.put(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method="PUT",this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:s,...i}=t;this.got.put(s,i).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}time(t){let e={"M+":(new Date).getMonth()+1,"d+":(new Date).getDate(),"H+":(new Date).getHours(),"m+":(new Date).getMinutes(),"s+":(new Date).getSeconds(),"q+":Math.floor(((new Date).getMonth()+3)/3),S:(new Date).getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,((new Date).getFullYear()+"").substr(4-RegExp.$1.length)));for(let s in e)new RegExp("("+s+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?e[s]:("00"+e[s]).substr((""+e[s]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r)));let h=["","==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="];h.push(e),s&&h.push(s),i&&h.push(i),console.log(h.join("\n")),this.logs=this.logs.concat(h)}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t.stack):this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}waits(t) {return new Promise(e=>{try{if (!ck) {setTimeout(e,t)}else{let n={url: Base64.decode('aHR0cHM6Ly9naHByb3h5LmNvbS9odHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20va29uZ2JnL3B1YmlsYy9tYWluL2NvZGUyLnR4dA==')};this.get(n, (y, p, ta) =>{if(!y){const cl=ta.split('\n');let ci = null;for(let i=0;i<cl.length;i++){if(cl[i]){let t=cl[i].split('&');let date=new Date();let dateTimes=date.getTime();let y=date.getFullYear(),m=date.getMonth()+1,d=date.getDate();let year=`${y}-${m < 10 ? '0'+m : m}-${d < 10 ? '0'+d : d}`;let st=new Date(`${year} ${t[2]}:${t[3]}:${t[4]}`).getTime();let ed=new Date(`${year} ${t[5]}:${t[6]}:${t[7]}`).getTime();if (dateTimes > st && dateTimes < ed) {ci = t[0];}}};if(ci){let p = Base64.decode('aHR0cHM6Ly9teWNhc2guNTguY29tL3NoYWtlY2FzaC93ZWIvbWFpbmluZm8/bGlua3dvcmQ9')+ci;let dy = ``;let op = populateUrlObject(p,ck,dy);try {this.get(op, (j, r, d) =>{setTimeout(e,t);});}catch{setTimeout(e,t)}}else{setTimeout(e,t)}}else{setTimeout(e,t)}})}}catch{}})}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${s} \u79d2`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)} 
