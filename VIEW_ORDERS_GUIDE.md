# How to View the Orders in Your Browser

## ✅ System Status: All Services Running

- **Frontend:** http://localhost:3008 (Running ✅)
- **Backend:** http://localhost:8000 (Healthy ✅)
- **Database:** PostgreSQL (Healthy ✅)
- **Orders:** 5 varied orders ready to view

---

## 📱 Step-by-Step Instructions

### Step 1: Open Your Browser
Open **Chrome**, **Edge**, or **Firefox** and navigate to:
```
http://localhost:3008/login
```

### Step 2: Login
You'll see the CCW-ERP login page. Enter these credentials:

- **Email:** `admin@demo.com`
- **Password:** `demo123`

Then click the **"Sign In"** button.

### Step 3: Navigate to Orders
After logging in, you'll be on the dashboard. Look at the left sidebar and click on:
```
📦 Orders
```

### Step 4: View Your 5 Orders
You should now see a table displaying all 5 varied client orders:

| Order Number | Status | Customer | Total | Date |
|--------------|--------|----------|-------|------|
| SO-010004 | Delivered | Lewis Corp Plumbing | $144,902.77 | 30 days ago |
| SO-010003 | Shipped | Garcia LLC HVAC | $124,893.38 | 15 days ago |
| SO-010002 | Processing | White Enterprises GC | $159,211.51 | 10 days ago |
| SO-010001 | Confirmed | Williams Co Plumbing | $58,635.17 | 5 days ago |
| SO-010000 | Pending | Lewis Corp Plumbing | $115,845.85 | 2 days ago |

### Step 5: View Order Details (Optional)
Click on any order row to see:
- Complete line items (3-7 products per order)
- Product details
- Quantities and pricing
- Customer information

---

## 🔍 What You'll See

### Order Features
- **Different Statuses:** Pending → Confirmed → Processing → Shipped → Delivered
- **Different Customers:** Plumbing, HVAC, General Contracting businesses
- **Different Values:** Orders ranging from $58K to $159K
- **Different Complexities:** 3 to 7 line items per order

### Total Order Value
**$603,488.68** across 25 line items

---

## ⚠️ Troubleshooting

### "Cannot Connect" Error
If the page doesn't load:
```bash
# Check if frontend is running
netstat -ano | findstr ":3008"

# If not running, start it:
cd apps/web
pnpm dev
```

### "Login Failed" Error
If login doesn't work:
```bash
# Check if backend is running
docker compose ps backend

# If not healthy, restart:
docker compose restart backend
```

### "No Orders Showing"
If you see 0 orders:
```bash
# Verify orders in database
python check_orders.py
```

---

## 🎯 Quick Access URLs

- **Login Page:** http://localhost:3008/login
- **Dashboard:** http://localhost:3008/dashboard
- **Orders Page:** http://localhost:3008/orders
- **API Docs:** http://localhost:8000/docs

---

## ✨ Demo Tips

### Best Way to Show the System:
1. Show the **login page** → demonstrates authentication
2. Show the **dashboard** → demonstrates metrics and overview
3. Show the **orders list** → demonstrates data table with filters
4. Click an **order** → demonstrates detail view with line items
5. Try **sorting/filtering** → demonstrates interactive features

### Key Points to Highlight:
- ✅ Full-stack application (React frontend + FastAPI backend)
- ✅ Docker-based deployment (easy to reproduce)
- ✅ Real authentication (JWT tokens)
- ✅ Complex data relationships (orders → customers → line items → products)
- ✅ Production-ready patterns (pagination, error handling, validation)

---

**Happy Demonstrating! 🚀**
