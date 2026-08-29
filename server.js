const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/*
====================================================
 FIREBASE ADMIN
====================================================

Tạo các biến Environment trên Replit:

FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY

Không ghi Service Account vào GitHub.
*/

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,

            clientEmail:
                process.env.FIREBASE_CLIENT_EMAIL,

            privateKey:
                process.env.FIREBASE_PRIVATE_KEY
                    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
                    : undefined
        })
    });
}

const db = admin.firestore();

/*
====================================================
 CẤU HÌNH SHOP
====================================================
*/

const PACKAGES = {
    "39k": {
        name: "Random Acc 39K",
        price: 39000
    },

    "49k": {
        name: "Random Acc 49K",
        price: 49000
    },

    "79k": {
        name: "Random Acc 79K",
        price: 79000
    },

    "99k": {
        name: "Random Acc 99K",
        price: 99000
    },

    "149k": {
        name: "Random Acc 149K",
        price: 149000
    },

    "199k": {
        name: "Random Acc 199K",
        price: 199000
    },

    "299k": {
        name: "Random Acc 299K",
        price: 299000
    },

    "499k": {
        name: "Random Acc 499K",
        price: 499000
    },

    "999k": {
        name: "Random Acc 999K",
        price: 999000
    }
};

/*
====================================================
 ADMIN
====================================================

Đổi ADMIN_EMAIL thành Gmail admin của mày.
*/

const ADMIN_EMAIL =
    process.env.ADMIN_EMAIL || "YOUR_ADMIN_EMAIL@gmail.com";


function isAdmin(email) {
    return (
        email &&
        email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
    );
}


/*
====================================================
 XÁC THỰC FIREBASE TOKEN
====================================================
*/

async function authMiddleware(req, res, next) {

    try {

        const header =
            req.headers.authorization || "";

        if (!header.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Chưa đăng nhập"
            });
        }

        const token =
            header.substring(7);

        const decoded =
            await admin.auth().verifyIdToken(token);

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Phiên đăng nhập không hợp lệ"
        });

    }
}


/*
====================================================
 ADMIN MIDDLEWARE
====================================================
*/

function adminMiddleware(req, res, next) {

    if (!isAdmin(req.user.email)) {
        return res.status(403).json({
            success: false,
            message: "Không có quyền quản trị"
        });
    }

    next();
}


/*
====================================================
 LẤY THÔNG TIN USER
====================================================
*/

app.get(
    "/api/me",
    authMiddleware,
    async (req, res) => {

        try {

            const ref =
                db.collection("users").doc(req.user.uid);

            const snap = await ref.get();

            if (!snap.exists) {

                await ref.set({
                    email: req.user.email,
                    balance: 0,
                    createdAt:
                        admin.firestore.FieldValue.serverTimestamp()
                });

                return res.json({
                    success: true,
                    email: req.user.email,
                    balance: 0,
                    admin: isAdmin(req.user.email)
                });
            }

            const data = snap.data();

            res.json({
                success: true,
                email: req.user.email,
                balance: Number(data.balance || 0),
                admin: isAdmin(req.user.email)
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Không thể lấy thông tin tài khoản"
            });

        }
    }
);


/*
====================================================
 TẠO YÊU CẦU NẠP TIỀN
====================================================
*/

app.post(
    "/api/deposit",
    authMiddleware,
    async (req, res) => {

        try {

            const amount =
                Number(req.body.amount);

            if (!Number.isFinite(amount)) {
                return res.status(400).json({
                    success: false,
                    message: "Số tiền không hợp lệ"
                });
            }

            if (amount < 10000) {
                return res.status(400).json({
                    success: false,
                    message: "Số tiền nạp tối thiểu 10.000đ"
                });
            }

            const orderId =
                "NAP" +
                Date.now().toString(36).toUpperCase() +
                Math.random()
                    .toString(36)
                    .substring(2, 7)
                    .toUpperCase();

            await db
                .collection("deposits")
                .doc(orderId)
                .set({

                    orderId,

                    uid:
                        req.user.uid,

                    email:
                        req.user.email,

                    amount,

                    status: "pending",

                    createdAt:
                        admin.firestore.FieldValue.serverTimestamp()

                });

            res.json({
                success: true,
                orderId,
                amount
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Không tạo được yêu cầu nạp"
            });

        }
    }
);


/*
====================================================
 DANH SÁCH GÓI
====================================================
*/

app.get(
    "/api/packages",
    async (req, res) => {

        const result = {};

        for (const [id, item] of Object.entries(PACKAGES)) {

            const snap =
                await db
                    .collection("accounts")
                    .where("packageId", "==", id)
                    .where("status", "==", "available")
                    .get();

            result[id] = {
                ...item,
                stock: snap.size
            };
        }

        res.json({
            success: true,
            packages: result
        });

    }
);


/*
====================================================
 MUA RANDOM ACC
====================================================
*/

app.post(
    "/api/buy",
    authMiddleware,
    async (req, res) => {

        try {

            const packageId =
                req.body.packageId;

            const product =
                PACKAGES[packageId];

            if (!product) {
                return res.status(400).json({
                    success: false,
                    message: "Gói không tồn tại"
                });
            }

            const userRef =
                db.collection("users")
                  .doc(req.user.uid);

            const accountQuery =
                await db
                    .collection("accounts")
                    .where(
                        "packageId",
                        "==",
                        packageId
                    )
                    .where(
                        "status",
                        "==",
                        "available"
                    )
                    .limit(10)
                    .get();

            if (accountQuery.empty) {

                return res.status(400).json({
                    success: false,
                    message: "Gói này hiện đã hết acc"
                });
            }

            const accountDocs =
                accountQuery.docs;

            const selected =
                accountDocs[
                    Math.floor(
                        Math.random() *
                        accountDocs.length
                    )
                ];

            const accountRef =
                selected.ref;

            const orderRef =
                db.collection("orders").doc();

            let deliveredAccount = null;

            await db.runTransaction(
                async transaction => {

                    const userSnap =
                        await transaction.get(userRef);

                    const accountSnap =
                        await transaction.get(accountRef);

                    if (!userSnap.exists) {
                        throw new Error(
                            "USER_NOT_FOUND"
                        );
                    }

                    if (!accountSnap.exists) {
                        throw new Error(
                            "ACCOUNT_NOT_FOUND"
                        );
                    }

                    const userData =
                        userSnap.data();

                    const accountData =
                        accountSnap.data();

                    const balance =
                        Number(
                            userData.balance || 0
                        );

                    if (
                        accountData.status !==
                        "available"
                    ) {
                        throw new Error(
                            "ACCOUNT_ALREADY_SOLD"
                        );
                    }

                    if (balance < product.price) {
                        throw new Error(
                            "INSUFFICIENT_BALANCE"
                        );
                    }

                    const newBalance =
                        balance - product.price;

                    deliveredAccount = {
                        username:
                            accountData.username,

                        password:
                            accountData.password
                    };

                    transaction.update(
                        userRef,
                        {
                            balance: newBalance
                        }
                    );

                    transaction.update(
                        accountRef,
                        {
                            status: "sold",

                            soldTo:
                                req.user.uid,

                            soldAt:
                                admin.firestore
                                    .FieldValue
                                    .serverTimestamp(),

                            orderId:
                                orderRef.id
                        }
                    );

                    transaction.set(
                        orderRef,
                        {

                            orderId:
                                orderRef.id,

                            uid:
                                req.user.uid,

                            email:
                                req.user.email,

                            packageId,

                            packageName:
                                product.name,

                            price:
                                product.price,

                            accountId:
                                accountRef.id,

                            status: "completed",

                            account:
                                deliveredAccount,

                            createdAt:
                                admin.firestore
                                    .FieldValue
                                    .serverTimestamp()
                        }
                    );

                }
            );

            res.json({

                success: true,

                orderId:
                    orderRef.id,

                packageName:
                    product.name,

                price:
                    product.price,

                account:
                    deliveredAccount

            });

        } catch (error) {

            console.error(error);

            if (
                error.message ===
                "INSUFFICIENT_BALANCE"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Số dư không đủ"
                });
            }

            if (
                error.message ===
                "ACCOUNT_ALREADY_SOLD"
            ) {
                return res.status(409).json({
                    success: false,
                    message: "Acc vừa được khách khác mua, hãy thử lại"
                });
            }

            res.status(500).json({
                success: false,
                message: "Mua acc thất bại"
            });

        }
    }
);


/*
====================================================
 LỊCH SỬ ĐƠN
====================================================
*/

app.get(
    "/api/orders",
    authMiddleware,
    async (req, res) => {

        try {

            const snap =
                await db
                    .collection("orders")
                    .where(
                        "uid",
                        "==",
                        req.user.uid
                    )
                    .get();

            const orders =
                snap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

            orders.sort(
                (a, b) =>
                    String(b.createdAt || "")
                        .localeCompare(
                            String(a.createdAt || "")
                        )
            );

            res.json({
                success: true,
                orders
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Không tải được lịch sử"
            });

        }
    }
);


/*
====================================================
 ADMIN - DUYỆT NẠP TIỀN
====================================================
*/

app.post(
    "/api/admin/deposit/:id/approve",
    authMiddleware,
    adminMiddleware,
    async (req, res) => {

        try {

            const depositRef =
                db
                    .collection("deposits")
                    .doc(req.params.id);

            await db.runTransaction(
                async transaction => {

                    const depositSnap =
                        await transaction.get(
                            depositRef
                        );

                    if (!depositSnap.exists) {
                        throw new Error(
                            "DEPOSIT_NOT_FOUND"
                        );
                    }

                    const deposit =
                        depositSnap.data();

                    if (
                        deposit.status !==
                        "pending"
                    ) {
                        throw new Error(
                            "ALREADY_PROCESSED"
                        );
                    }

                    const userRef =
                        db
                            .collection("users")
                            .doc(deposit.uid);

                    const userSnap =
                        await transaction.get(
                            userRef
                        );

                    if (!userSnap.exists) {
                        throw new Error(
                            "USER_NOT_FOUND"
                        );
                    }

                    const currentBalance =
                        Number(
                            userSnap.data().balance || 0
                        );

                    const newBalance =
                        currentBalance +
                        Number(deposit.amount);

                    transaction.update(
                        userRef,
                        {
                            balance: newBalance
                        }
                    );

                    transaction.update(
                        depositRef,
                        {
                            status: "approved",

                            approvedAt:
                                admin.firestore
                                    .FieldValue
                                    .serverTimestamp(),

                            approvedBy:
                                req.user.email
                        }
                    );

                    transaction.set(
                        db.collection(
                            "transactions"
                        ).doc(),
                        {

                            uid:
                                deposit.uid,

                            type:
                                "deposit",

                            amount:
                                Number(deposit.amount),

                            depositId:
                                depositRef.id,

                            createdAt:
                                admin.firestore
                                    .FieldValue
                                    .serverTimestamp()
                        }
                    );

                }
            );

            res.json({
                success: true,
                message: "Đã cộng tiền"
            });

        } catch (error) {

            console.error(error);

            res.status(400).json({
                success: false,
                message:
                    "Không thể duyệt yêu cầu"
            });

        }
    }
);


/*
====================================================
 ADMIN - NHẬP KHO ACC
====================================================

POST JSON:

{
  "packageId": "99k",
  "username": "...",
  "password": "..."
}
*/

app.post(
    "/api/admin/accounts",
    authMiddleware,
    adminMiddleware,
    async (req, res) => {

        try {

            const {
                packageId,
                username,
                password
            } = req.body;

            if (!PACKAGES[packageId]) {
                return res.status(400).json({
                    success: false,
                    message: "Gói không tồn tại"
                });
            }

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Thiếu tài khoản hoặc mật khẩu"
                });
            }

            const ref =
                await db.collection("accounts")
                    .add({

                        packageId,

                        username,

                        password,

                        status: "available",

                        createdAt:
                            admin.firestore
                                .FieldValue
                                .serverTimestamp()

                    });

            res.json({
                success: true,
                id: ref.id
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Không thể nhập kho"
            });

        }
    }
);


/*
====================================================
 ADMIN - DANH SÁCH YÊU CẦU NẠP
====================================================
*/

app.get(
    "/api/admin/deposits",
    authMiddleware,
    adminMiddleware,
    async (req, res) => {

        try {

            const snap =
                await db
                    .collection("deposits")
                    .where(
                        "status",
                        "==",
                        "pending"
                    )
                    .get();

            const deposits =
                snap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

            res.json({
                success: true,
                deposits
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message: "Lỗi tải đơn nạp"
            });

        }
    }
);


/*
====================================================
 HOME
====================================================
*/

app.get("*", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


const PORT =
    process.env.PORT || 3000;

app.listen(
    PORT,
    () => {
        console.log(
            `SHOP RANDOM ACC FF chạy tại port ${PORT}`
        );
    }
);
