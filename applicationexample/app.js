const express = require('express');
const app = express();
const session = require('express-session');

const router = express.Router();

app.use(session({
  secret: '1234',
  resave: false,
  saveUninitialized: true
}));

app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

const mysql = require('mysql2')
const db_info = {
    host: "localhost",
    port: "3306",
    user: "root",
    password: "sgfdsg0103",
    database: "db_2022051730"
}
const sql_connection = mysql.createConnection(db_info);
sql_connection.connect();

app.use(express.json())
app.use(express.urlencoded({extended : true}))

app.use('/', router)

// router.route("/")
// .get((req, res) => {
//     res.render("app")
// })

app.set("view engine", "ejs")
app.set("views", "./views")

app.get("/", (req, res) => {
    const searchQuery = req.query.search || '';

    const sqlStocks = searchQuery 
        ? 'SELECT * FROM 종목 WHERE 종목명 LIKE ?'
        : 'SELECT * FROM 종목';

    const sqlTopStocks = 'SELECT * FROM 종목 ORDER BY 현재가 DESC';

    const params = searchQuery ? [`%${searchQuery}%`] : [];

    sql_connection.query(sqlStocks, params, (error, results) => {
        if (error) throw error;

        const stocks = results.map(stock => ({
            종목명: stock.종목명,
            현재가: stock.현재가,
            등락률: stock.등락률
        }));

        sql_connection.query(sqlTopStocks, (error, topResults) => {
            if (error) throw error;

            const topStocks = topResults.map(stock => ({
                종목명: stock.종목명,
                현재가: stock.현재가,
                등락률: stock.등락률
            }));

            res.render("app", { stocks, topStocks, searchQuery, session: req.session });
        });
    });
});




app.get("/login", (req, res) => {
    res.render("loginPage")
})

app.post("/login", (req, res) => {
    const {userID, userPassword} = req.body;
    


    sql_connection.query('SELECT * FROM 사용자 WHERE userID = ? AND userPassword = ?', [userID, userPassword], (error, results, field) =>{
        if(error) throw error;
        if(results.length > 0){
            req.session.userID = userID; 
            req.session.예수금 = results[0].예수금;
            req.session.사용자ID = results[0].사용자ID;
            res.redirect("/myinfo");
        }
        else{
            res.render("loginPage", {loginResult: 'fail'});
        }
    }
)
})


app.get("/signup", (req, res) => {
    res.render("signupPage")
})

app.post("/signup", (req, res) => {
    const {userID, userPassword} = req.body;
    
    sql_connection.query('SELECT * FROM 사용자 WHERE userID = ?', [userID], (error, results, field) => {
        if(error) throw error;
        if(results.length > 0){
            res.send("이미 존재하는 아이디입니다.")
        }
        else {
            if(!userPassword || userPassword.trim() === ""){
                res.send("패스워드를 입력해주세요.");
            }
            else{
                sql_connection.query('SELECT MAX(사용자ID) AS maxID FROM 사용자', (error, results) => {
                    if (error) throw error;

                    const 사용자ID = results[0].maxID ? results[0].maxID + 1 : 1;
            
                    sql_connection.query('INSERT INTO 사용자(사용자ID, userID, userPassword) values (?, ?, ?)', [사용자ID, userID, userPassword], (error, results, field) => {
                        if(error) throw error;
                        else {
                            req.session.userID = userID;
                            res.redirect('/');
                    }})
                })
            }
        }
    })
})

app.get("/deleteUser", (req, res) => {
    res.render("deleteUserPage")
})


app.post("/deleteUser", (req, res) => {
    const { userID, userPassword } = req.body;
    
    if (!userID || userID.trim() === "" || !userPassword || userPassword.trim() === "") {
        return res.send("아이디와 패스워드를 모두 입력해주세요.");
    }

    sql_connection.query('DELETE FROM 사용자 WHERE userID = ? AND userPassword = ?', [userID, userPassword], (error, results, field) => {
        if (error) throw error;
        
        if (results.affectedRows === 0) {
            res.send("아이디 또는 비밀번호가 일치하지 않습니다.");
        } else {
            req.session.userID = null;
            res.redirect('/');
        }
    });
});

app.get("/myinfo", (req, res) => {
    const userID = req.session.userID;

    sql_connection.query("SELECT 예수금 FROM 사용자 WHERE userID = ?", [userID], (error, results) => {
        if (error) throw error;
        const balance = parseInt(results[0].예수금);
        res.render('myinfoPage', { balance }); 
    });
})

app.post("/myinfo", (req, res) => {
    const 입금액  = req.body.amount;
    const userID = req.session.userID; 

    
    if (req.body.action === "로그아웃") {
        req.session.userID = null;
        return res.redirect('/'); 
    }

    if (!userID) {
        return res.redirect('/login'); 
    }

    if (req.body.action === "홈") {
        return res.redirect('/'); 
    }

    if (req.body.action === "보유주식") {
        return res.redirect('/viewPortfolio'); 
    }

    if (req.body.action === "거래내역") {
        return res.redirect('/viewTradeHistory'); 
    }

    const query = req.body.action ===  "입금" ? 'UPDATE 사용자 SET 예수금 = 예수금 + ? WHERE userID = ?' :
    'UPDATE 사용자 SET 예수금 = 예수금 - ? WHERE userID = ?'

    sql_connection.query(query, [입금액, userID], (error, results) => {
        if (error) throw error;
        res.redirect("/myinfo");
    });


})

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});


app.get("/viewPortfolio", (req, res) => {
    const userID = req.session.userID;
    const 사용자ID = req.session.사용자ID;
    const searchQuery = req.query.query || "";

    if (!userID) {
        return res.redirect('/login');
    }

    const sqlQuery = searchQuery
        ? "SELECT 보유주식.종목명, 보유주식.매수가, 보유주식.보유량, 보유주식.거래가능수량, 종목.현재가 " +
          "FROM 보유주식 " +
          "JOIN 종목 ON 보유주식.종목명 = 종목.종목명 " +
          "WHERE 보유주식.사용자ID = ? AND 보유주식.종목명 LIKE ? ORDER BY 보유주식.종목명 ASC"
        : "SELECT 보유주식.종목명, 보유주식.매수가, 보유주식.보유량, 보유주식.거래가능수량, 종목.현재가 " +
          "FROM 보유주식 " +
          "JOIN 종목 ON 보유주식.종목명 = 종목.종목명 " +
          "WHERE 보유주식.사용자ID = ? ORDER BY 보유주식.종목명 ASC"

    // 검색어가 있을 경우 `%${searchQuery}%`로 감싸서 부분 일치 검색을 수행
    const queryParams = searchQuery ? [사용자ID, `%${searchQuery}%`] : [사용자ID];

    sql_connection.query(sqlQuery, queryParams, (error, results) => {
        if (error) throw error;

        const stocks = results.map(stock => ({
            종목명: stock.종목명,
            매수가: parseInt(stock.매수가, 10),
            보유량: stock.보유량,
            거래가능수량: stock.거래가능수량,
            현재가: stock.현재가,
            평가금액: (stock.현재가 - stock.매수가) * stock.보유량
        }));

        res.render('viewPortfolioPage', { stocks, searchQuery});
    });
});


app.get("/viewTradeHistory", (req, res) => {
    const userID = req.session.userID;
    const 사용자ID = req.session.사용자ID;
    const searchQuery = req.query.query || "";
    const startDate = req.query.startDate || "";
    const endDate = req.query.endDate || "";

    if (!userID) {
        return res.redirect('/login');
    }

    let sqlQuery = "SELECT 거래ID, 종목명, 매수매도, 거래수량, 거래날짜및시간 " +
                   "FROM 거래내역 " +
                   "WHERE 사용자ID = ?";
    const queryParams = [사용자ID];

    if (searchQuery) {
        sqlQuery += " AND 종목명 LIKE ?";
        queryParams.push(`%${searchQuery}%`);
    }

    if (startDate && endDate) {
        const endDateNextDay = new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
        sqlQuery += " AND 거래날짜및시간 BETWEEN ? AND ?";
        queryParams.push(startDate, endDateNextDay);
    }


    // 정렬 조건 추가
    sqlQuery += " ORDER BY 거래날짜및시간 ASC";

    sql_connection.query(sqlQuery, queryParams, (error, results) => {
        if (error) throw error;

        const transactions = results.map(transaction => ({
            거래ID: transaction.거래ID,
            종목명: transaction.종목명,
            매수매도: transaction.매수매도,
            거래수량: transaction.거래수량,
            거래날짜및시간: transaction.거래날짜및시간
        }));

        // EJS 템플릿에 거래 내역과 검색 조건 전달
        res.render('viewTradeHistory', { transactions, searchQuery, startDate, endDate  });
    });
});

app.get("/stock", (req, res) => {
    const stockName = req.query.종목명;  
    const { startDate, endDate } = req.query;

    // 거래내역 쿼리
    let transactionSql = `SELECT 매수매도, 거래가격, 거래수량, 거래날짜및시간 
                          FROM 거래내역 
                          WHERE 종목명 = ?`;
    const transactionParams = [stockName];

    // 기간이 있을 경우 기간 조건 추가
    if (startDate && endDate) {
        // endDate를 하루 뒤로 설정
        const endDateNextDay = new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
        transactionSql += ` AND 거래날짜및시간 BETWEEN ? AND ?`;
        transactionParams.push(startDate, endDateNextDay);
    }

    // 호가 데이터 쿼리
    const hogaSql = `
        SELECT 호가단계, 매도잔량, 가격, 매수잔량 
        FROM 5단계호가창 
        WHERE 종목명 = ?
        ORDER BY 호가단계 DESC
    `;

    // 두 개의 쿼리를 실행하고 결과를 함께 렌더링
    sql_connection.query(transactionSql, transactionParams, (error, transactionResults) => {
        if (error) throw error;

        sql_connection.query(hogaSql, [stockName], (error, hogaResults) => {
            if (error) throw error;

            res.render('stockDetail', { 
                stockName, 
                transactions: transactionResults,
                hogaData: hogaResults 
            });
        });
    });
});

app.get('/marketBuy', (req, res) => {
    const stockName = req.query.종목명;
    if (!stockName) {
        return res.status(400).send("종목명을 지정해 주세요.");
    }

    res.render('marketBuy', {
        stockName: stockName
    });
})

app.post('/order/marketBuy', async (req, res) => {
    const { 종목명, 매수량, 주문방식, 지정가 } = req.body;
    const 사용자ID = req.session.사용자ID;
    let remainingQty = 매수량;
    let totalCost = 0;

    try {
        // 매도 가격 조회 (호가 단계 1)
        const [[{ 가격: 매도가격, 매도잔량 }]] = await sql_connection.promise().query(`
            SELECT 가격, 매도잔량 FROM 5단계호가창 WHERE 종목명 = ? AND 호가단계 = 1
        `, [종목명]);

        // 지정가 주문 처리
        if (주문방식 === "지정가" && 지정가) {
            const [[existingHoga]] = await sql_connection.promise().query(`
                SELECT * FROM 5단계호가창 WHERE 종목명 = ? AND 가격 = ?
            `, [종목명, 지정가]);

            if (existingHoga) {
                if (existingHoga.매도잔량 > 0) {
                    const matchedQty = Math.min(existingHoga.매도잔량, remainingQty);
                    totalCost += matchedQty * 지정가;
                    remainingQty -= matchedQty;

                    await sql_connection.promise().query(`
                        UPDATE 5단계호가창 SET 매도잔량 = 매도잔량 - ? WHERE 종목명 = ? AND 가격 = ?
                    `, [matchedQty, 종목명, 지정가]);

                    const [[{ maxTradeID }]] = await sql_connection.promise().query(`
                        SELECT COALESCE(MAX(거래ID), 0) + 1 AS maxTradeID FROM 거래내역
                    `);

                    await sql_connection.promise().query(`
                        INSERT INTO 거래내역 (거래ID, 사용자ID, 종목명, 매수매도, 거래가격, 거래수량, 거래날짜및시간)
                        VALUES (?, ?, ?, '매수', ?, ?, NOW())
                    `, [maxTradeID, 사용자ID, 종목명, 지정가, matchedQty]);

                    await sql_connection.promise().query(`
                        UPDATE 사용자 SET 예수금 = 예수금 - ? WHERE 사용자ID = ?
                    `, [totalCost, 사용자ID]);

                    await sql_connection.promise().query(`
                        INSERT INTO 보유주식 (사용자ID, 종목명, 매수가, 보유량, 거래가능수량, 평가금액)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE 
                            보유량 = 보유량 + VALUES(보유량),
                            거래가능수량 = 거래가능수량 + VALUES(거래가능수량),
                            평가금액 = (? - 매수가) * 보유량
                    `, [
                        사용자ID, 종목명, 지정가, matchedQty, matchedQty, 지정가 * matchedQty,
                        지정가
                    ]);

                    const [sellOrders] = await sql_connection.promise().query(`
                        SELECT * FROM 주문내역 WHERE 종목명 = ? AND 매수매도 = '매도' AND 주문가격 = ? ORDER BY 주문날짜 ASC
                    `, [종목명, 지정가]);

                    let remainingMatchedQty = matchedQty;
                    for (const order of sellOrders) {
                        const qtyToDeduct = Math.min(order.주문수량, remainingMatchedQty);
                        remainingMatchedQty -= qtyToDeduct;

                        if (order.주문수량 === qtyToDeduct) {
                            await sql_connection.promise().query(`DELETE FROM 주문내역 WHERE 주문ID = ?`, [order.주문ID]);
                        } else {
                            await sql_connection.promise().query(`
                                UPDATE 주문내역 SET 주문수량 = 주문수량 - ? WHERE 주문ID = ?
                            `, [qtyToDeduct, order.주문ID]);
                        }
                        if (remainingMatchedQty <= 0) break;
                    }
                    res.send("지정가 매수가 성공적으로 처리되었습니다.");
                } else {
                    await sql_connection.promise().query(`
                        UPDATE 5단계호가창 SET 매수잔량 = 매수잔량 + ? WHERE 종목명 = ? AND 가격 = ?
                    `, [remainingQty, 종목명, 지정가]);

                    await sql_connection.promise().query(`
                        INSERT INTO 주문내역 (사용자ID, 종목명, 매수매도, 주문방식, 주문가격, 주문수량, 주문날짜)
                        VALUES (?, ?, '매수', '지정가', ?, ?, NOW())
                    `, [사용자ID, 종목명, 지정가, remainingQty]);
                }
                res.send(`
                    <div>
                        <p>지정가 매수 주문이 성공적으로 처리되었습니다.</p>
                        <button onclick="window.location.href='/cancelOrder?종목명=${encodeURIComponent(종목명)}&매수매도=${encodeURIComponent('매도')}&주문방식=${encodeURIComponent('지정가')}&주문수량=${encodeURIComponent(remainingQty)}'">주문 취소</button>
                    </div>
                `);
                           
            } else {
                await sql_connection.promise().query(`
                    INSERT INTO 주문내역 (사용자ID, 종목명, 매수매도, 주문방식, 주문가격, 주문수량, 주문날짜)
                    VALUES (?, ?, '매수', '지정가', ?, ?, NOW())
                `, [사용자ID, 종목명, 지정가, remainingQty]);
                res.send(`
                    <div>
                        <p>지정가 매수 주문이 성공적으로 처리되었습니다.</p>
                        <button onclick="window.location.href='/cancelOrder?종목명=${encodeURIComponent(종목명)}&매수매도=${encodeURIComponent('매도')}&주문방식=${encodeURIComponent('지정가')}&주문수량=${encodeURIComponent(remainingQty)}'">주문 취소</button>
                    </div>
                `);
                
            }
            
            return;
        }

        // 시장가 매수 주문 처리 (항상 호가 단계 1의 가격으로 거래)
        if (매도잔량 > 0) {
            const matchedQty = Math.min(매도잔량, remainingQty);
            totalCost += matchedQty * 매도가격;
            remainingQty -= matchedQty;

            await sql_connection.promise().query(`
                UPDATE 5단계호가창 SET 매도잔량 = 매도잔량 - ? WHERE 종목명 = ? AND 호가단계 = 1
            `, [matchedQty, 종목명]);

            const [[{ maxTradeID }]] = await sql_connection.promise().query(`
                SELECT COALESCE(MAX(거래ID), 0) + 1 AS maxTradeID FROM 거래내역
            `);

            await sql_connection.promise().query(`
                INSERT INTO 거래내역 (거래ID, 사용자ID, 종목명, 매수매도, 거래가격, 거래수량, 거래날짜및시간)
                VALUES (?, ?, ?, '매수', ?, ?, NOW())
            `, [maxTradeID, 사용자ID, 종목명, 매도가격, matchedQty]);

            await sql_connection.promise().query(`
                UPDATE 사용자 SET 예수금 = 예수금 - ? WHERE 사용자ID = ?
            `, [totalCost, 사용자ID]);

            await sql_connection.promise().query(`
                INSERT INTO 보유주식 (사용자ID, 종목명, 매수가, 보유량, 거래가능수량, 평가금액)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    보유량 = 보유량 + VALUES(보유량),
                    거래가능수량 = 거래가능수량 + VALUES(거래가능수량),
                    평가금액 = (? - 매수가) * 보유량
            `, [
                사용자ID, 종목명, 매도가격, matchedQty, matchedQty, 매도가격 * matchedQty,
                매도가격
            ]);
        }

        if (remainingQty > 0) {
            await sql_connection.promise().query(`
                INSERT INTO 주문내역 (사용자ID, 종목명, 매수매도, 주문방식, 주문가격, 주문수량, 주문날짜)
                VALUES (?, ?, '매수', '시장가', ?, ?, NOW())
            `, [사용자ID, 종목명, 매도가격, remainingQty]);
        }

        await sql_connection.promise().query(`
            UPDATE 종목 SET 현재가 = ? WHERE 종목명 = ?
        `, [매도가격, 종목명]);

        res.send("시장가 매수가 성공적으로 체결되었습니다.");
    } catch (error) {
        console.error("시장가 매수 오류:", error);
        res.status(500).send("시장가 매수 중 오류가 발생했습니다.");
    }
});



app.get('/marketSell', (req, res) => {
    const stockName = req.query.종목명;
    if (!stockName) {
        return res.status(400).send("종목명을 지정해 주세요.");
    }

    res.render('marketSell', {
        stockName: stockName
    });
})

app.post('/order/marketSell', async (req, res) => {
    const { 종목명, 매도량, 주문방식, 지정가 } = req.body;
    const 사용자ID = req.session.사용자ID;
    let remainingQty = 매도량;
    let totalRevenue = 0;

    try {
        // 매수 가격 조회 (호가 단계 -1)
        const [[{ 가격: 매수가격, 매수잔량 }]] = await sql_connection.promise().query(`
            SELECT 가격, 매수잔량 FROM 5단계호가창 WHERE 종목명 = ? AND 호가단계 = -1
        `, [종목명]);

        // 지정가 주문 처리
        if (주문방식 === "지정가" && 지정가) {
            const [[existingHoga]] = await sql_connection.promise().query(`
                SELECT * FROM 5단계호가창 WHERE 종목명 = ? AND 가격 = ?
            `, [종목명, 지정가]);

            if (existingHoga) {
                if (existingHoga.매수잔량 > 0) {
                    const matchedQty = Math.min(existingHoga.매수잔량, remainingQty);
                    totalRevenue += matchedQty * 지정가;
                    remainingQty -= matchedQty;

                    await sql_connection.promise().query(`
                        UPDATE 5단계호가창 SET 매수잔량 = 매수잔량 - ? WHERE 종목명 = ? AND 가격 = ?
                    `, [matchedQty, 종목명, 지정가]);

                    const [[{ maxTradeID }]] = await sql_connection.promise().query(`
                        SELECT COALESCE(MAX(거래ID), 0) + 1 AS maxTradeID FROM 거래내역
                    `);

                    await sql_connection.promise().query(`
                        INSERT INTO 거래내역 (거래ID, 사용자ID, 종목명, 매수매도, 거래가격, 거래수량, 거래날짜및시간)
                        VALUES (?, ?, ?, '매도', ?, ?, NOW())
                    `, [maxTradeID, 사용자ID, 종목명, 지정가, matchedQty]);

                    await sql_connection.promise().query(`
                        UPDATE 사용자 SET 예수금 = 예수금 + ? WHERE 사용자ID = ?
                    `, [totalRevenue, 사용자ID]);

                    await sql_connection.promise().query(`
                        UPDATE 보유주식
                        SET 보유량 = 보유량 - ?, 거래가능수량 = 거래가능수량 - ?, 평가금액 = (? - 매수가) * 보유량
                        WHERE 사용자ID = ? AND 종목명 = ?
                    `, [matchedQty, matchedQty, 지정가, 사용자ID, 종목명]);

                    await sql_connection.promise().query(`
                        DELETE FROM 보유주식
                        WHERE 사용자ID = ? AND 종목명 = ? AND 보유량 = 0
                    `, [사용자ID, 종목명]);

                    const [buyOrders] = await sql_connection.promise().query(`
                        SELECT * FROM 주문내역 WHERE 종목명 = ? AND 매수매도 = '매수' AND 주문가격 = ? ORDER BY 주문날짜 ASC
                    `, [종목명, 지정가]);

                    let remainingMatchedQty = matchedQty;
                    for (const order of buyOrders) {
                        const qtyToDeduct = Math.min(order.주문수량, remainingMatchedQty);
                        remainingMatchedQty -= qtyToDeduct;

                        if (order.주문수량 === qtyToDeduct) {
                            await sql_connection.promise().query(`DELETE FROM 주문내역 WHERE 주문ID = ?`, [order.주문ID]);
                        } else {
                            await sql_connection.promise().query(`
                                UPDATE 주문내역 SET 주문수량 = 주문수량 - ? WHERE 주문ID = ?
                            `, [qtyToDeduct, order.주문ID]);
                        }
                        if (remainingMatchedQty <= 0) break;
                    }
                    res.send("지정가 매도가 성공적으로 처리되었습니다.");
                } else {
                    await sql_connection.promise().query(`
                        UPDATE 5단계호가창 SET 매도잔량 = 매도잔량 + ? WHERE 종목명 = ? AND 가격 = ?
                    `, [remainingQty, 종목명, 지정가]);

                    await sql_connection.promise().query(`
                        INSERT INTO 주문내역 (사용자ID, 종목명, 매수매도, 주문방식, 주문가격, 주문수량, 주문날짜)
                        VALUES (?, ?, '매도', '지정가', ?, ?, NOW())
                    `, [사용자ID, 종목명, 지정가, remainingQty]);
                }

                res.send(`
                    <div>
                        <p>지정가 매도 주문이 성공적으로 처리되었습니다.</p>
                        <button onclick="window.location.href='/cancelOrder?종목명=${encodeURIComponent(종목명)}&매수매도=${encodeURIComponent('매도')}&주문방식=${encodeURIComponent('지정가')}&주문수량=${encodeURIComponent(remainingQty)}'">주문 취소</button>
                    </div>
                `);
                
                
            } else {
                await sql_connection.promise().query(`
                    INSERT INTO 주문내역 (사용자ID, 종목명, 매수매도, 주문방식, 주문가격, 주문수량, 주문날짜)
                    VALUES (?, ?, '매도', '지정가', ?, ?, NOW())
                `, [사용자ID, 종목명, 지정가, remainingQty]);

                res.send(`
                    <div>
                        <p>지정가 매도 주문이 성공적으로 처리되었습니다.</p>
                        <button onclick="window.location.href='/cancelOrder?종목명=${encodeURIComponent(종목명)}&매수매도=${encodeURIComponent('매도')}&주문방식=${encodeURIComponent('지정가')}&주문수량=${encodeURIComponent(remainingQty)}'">주문 취소</button>
                    </div>
                `);
                
                
            }
            
            return;
        }

        // 시장가 매도 주문 처리 (항상 호가 단계 -1의 가격으로 거래)
        if (매수잔량 > 0) {
            const matchedQty = Math.min(매수잔량, remainingQty);
            totalRevenue += matchedQty * 매수가격;
            remainingQty -= matchedQty;

            await sql_connection.promise().query(`
                UPDATE 5단계호가창 SET 매수잔량 = 매수잔량 - ? WHERE 종목명 = ? AND 호가단계 = -1
            `, [matchedQty, 종목명]);

            const [[{ maxTradeID }]] = await sql_connection.promise().query(`
                SELECT COALESCE(MAX(거래ID), 0) + 1 AS maxTradeID FROM 거래내역
            `);

            await sql_connection.promise().query(`
                INSERT INTO 거래내역 (거래ID, 사용자ID, 종목명, 매수매도, 거래가격, 거래수량, 거래날짜및시간)
                VALUES (?, ?, ?, '매도', ?, ?, NOW())
            `, [maxTradeID, 사용자ID, 종목명, 매수가격, matchedQty]);

            await sql_connection.promise().query(`
                UPDATE 사용자 SET 예수금 = 예수금 + ? WHERE 사용자ID = ?
            `, [totalRevenue, 사용자ID]);

            await sql_connection.promise().query(`
                UPDATE 보유주식
                SET 보유량 = 보유량 - ?, 거래가능수량 = 거래가능수량 - ?, 평가금액 = (? - 매수가) * 보유량
                WHERE 사용자ID = ? AND 종목명 = ?
            `, [matchedQty, matchedQty, 매수가격, 사용자ID, 종목명]);

            await sql_connection.promise().query(`
                DELETE FROM 보유주식
                WHERE 사용자ID = ? AND 종목명 = ? AND 보유량 = 0
            `, [사용자ID, 종목명]);

            const [buyOrders] = await sql_connection.promise().query(`
                SELECT * FROM 주문내역 
                WHERE 종목명 = ? AND 매수매도 = '매수' AND 주문가격 = ?
                ORDER BY 주문날짜 ASC
            `, [종목명, 매수가격]);
        
            let remainingMatchedQty = matchedQty;
            for (const order of buyOrders) {
                const qtyToDeduct = Math.min(order.주문수량, remainingMatchedQty);
                remainingMatchedQty -= qtyToDeduct;
        
                // Delete or update 매수 주문내역
                if (order.주문수량 === qtyToDeduct) {
                    await sql_connection.promise().query(`DELETE FROM 주문내역 WHERE 주문ID = ?`, [order.주문ID]);
                } else {
                    await sql_connection.promise().query(`
                        UPDATE 주문내역 SET 주문수량 = 주문수량 - ? WHERE 주문ID = ?
                    `, [qtyToDeduct, order.주문ID]);
                }
        
                if (remainingMatchedQty <= 0) break;
            }
        }

        if (remainingQty > 0) {
            await sql_connection.promise().query(`
                INSERT INTO 주문내역 (사용자ID, 종목명, 매수매도, 주문방식, 주문가격, 주문수량, 주문날짜)
                VALUES (?, ?, '매도', '시장가', ?, ?, NOW())
            `, [사용자ID, 종목명, 매수가격, remainingQty]);
        }

        await sql_connection.promise().query(`
            UPDATE 종목 SET 현재가 = ? WHERE 종목명 = ?
        `, [매수가격, 종목명]);

        res.send("시장가 매도가 성공적으로 체결되었습니다.");
    } catch (error) {
        console.error("시장가 매도 오류:", error);
        res.status(500).send("시장가 매도 중 오류가 발생했습니다.");
    }
});

app.get('/cancelOrder', async (req, res) => {
    const { 종목명, 매수매도, 주문방식, 주문가격, 주문수량 } = req.query; // 쿼리에서 매수매도 값을 받아옵니다
    const 사용자ID = req.session.사용자ID;

    console.log(종목명)
    console.log(매수매도)
    console.log(주문방식)
    
    try {
        await sql_connection.promise().query(`
            DELETE FROM 주문내역 
            WHERE 사용자ID = ? AND 종목명 = ? AND 매수매도 = ? AND 주문방식 = ?
        `, [사용자ID, 종목명, 매수매도, 주문방식]);

        if (매수매도 === '매수') {
            // 매수 주문 취소 시, 매수잔량 감소
            await sql_connection.promise().query(`
                UPDATE 5단계호가창 
                SET 매수잔량 = 매수잔량 + ?
                WHERE 종목명 = ? AND 가격 = ? AND 호가단계 = -1
            `, [주문수량, 종목명, 주문가격]);
        } else if (매수매도 === '매도') {
            // 매도 주문 취소 시, 매도잔량 감소
            await sql_connection.promise().query(`
                UPDATE 5단계호가창 
                SET 매도잔량 = 매도잔량 + ?
                WHERE 종목명 = ? AND 가격 = ? AND 호가단계 = 1
            `, [주문수량, 종목명, 주문가격]);
        }

        res.send("주문이 취소되었습니다.");
    } catch (error) {
        console.error("주문 취소 오류:", error);
        res.status(500).send("주문 취소 중 오류가 발생했습니다.");
    }
});



app.listen(3000, ()=> {
    console.log('서버 실행 중');
})