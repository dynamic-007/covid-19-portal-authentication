const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const initializeAndDbAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log(`server is running on http://localhost:3000`);
    });
  } catch (error) {
    console.log(`Database error is ${error}`);
    process.exit(1);
  }
};
initializeAndDbAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "dheeraj_key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "dheeraj_key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 1
//Returns a list of all states in the state table
const convertStateDbObjectAPI1 = (objectItem) => {
  return {
    stateId: objectItem.state_id,
    stateName: objectItem.state_name,
    population: objectItem.population,
  };
};
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesListQuery = `select * from state;`;
  const getStatesListQueryResponse = await db.all(getStatesListQuery);
  response.send(
    getStatesListQueryResponse.map((eachState) =>
      convertStateDbObjectAPI1(eachState)
    )
  );
});

//API 2
//Returns a state based on the state ID

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatesListByIdQuery = `select * from state where state_id = ${stateId};`;
  const getStatesListByIdQueryResponse = await db.get(getStatesListByIdQuery);
  response.send(convertStateDbObjectAPI1(getStatesListByIdQueryResponse));
});

//API 3
//Create a district in the district table, district_id is auto-incremented

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `insert into district(district_name,state_id,cases,cured,active,deaths)
    values('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  const createDistrictQueryResponse = await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//API 4
//Returns a district based on the district ID
const convertDbObjectAPI4 = (objectItem) => {
  return {
    districtId: objectItem.district_id,
    districtName: objectItem.district_name,
    stateId: objectItem.state_id,
    cases: objectItem.cases,
    cured: objectItem.cured,
    active: objectItem.active,
    deaths: objectItem.deaths,
  };
};
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictByIdQuery = `select * from district where district_id=${districtId};`;
    const getDistrictByIdQueryResponse = await db.get(getDistrictByIdQuery);
    response.send(convertDbObjectAPI4(getDistrictByIdQueryResponse));
  }
);

//API 5
// Deletes a district from the district table based on the district ID
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `delete from district where district_id=${districtId};`;
    const deleteDistrictQueryResponse = await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 6
//Updates the details of a specific district based on the district ID
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `update district set
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths} where district_id = ${districtId};`;

    const updateDistrictQueryResponse = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 7
//Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateByIDStatsQuery = `select sum(cases) as totalCases, sum(cured) as totalCured,
    sum(active) as totalActive , sum(deaths) as totalDeaths from district where state_id = ${stateId};`;

    const getStateByIDStatsQueryResponse = await db.get(getStateByIDStatsQuery);
    response.send(getStateByIDStatsQueryResponse);
  }
);

//API 8
// Returns an object containing the state name of a district based on the district ID
app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictIdQuery = `select state_id from district where district_id = ${districtId};`;
    const getDistrictIdQueryResponse = await db.get(getDistrictIdQuery);
    //console.log(typeof getDistrictIdQueryResponse.state_id);
    const getStateNameQuery = `select state_name as stateName from state where 
  state_id = ${getDistrictIdQueryResponse.state_id}`;
    const getStateNameQueryResponse = await db.get(getStateNameQuery);
    response.send(getStateNameQueryResponse);
  }
);

module.exports = app;
