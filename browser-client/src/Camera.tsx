import { Grid, InputLabel, MenuItem, Select, Switch } from "@mui/material";
import Button from "@mui/material/Button";
import { NstrumentaBrowserClient } from "nstrumenta/dist/browser/client";
import React, { LegacyRef, MutableRefObject } from "react";
import Webcam from "react-webcam";
import { v4 as uuidv4 } from "uuid";
import "./index.css";

const FACING_MODE_USER = "user";
const FACING_MODE_ENVIRONMENT = "environment";

const videoConstraints = {
  facingMode: FACING_MODE_USER,
};

type Detection = {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  score: number;
  label: string;
  imageTag: string;
};

type Occupation = "empty" | "present";
let occupation: Occupation = "empty";

const Camera = () => {
  const [captureInterval, setCaptureInterval] = React.useState<number | string>(
    1
  );
  const [discordStatus, setDiscordStatus] = React.useState<string>();
  const webcamRef = React.useRef<Webcam>();
  const webcamContainerRef = React.useRef<HTMLDivElement>();
  const [responseChannel] = React.useState(uuidv4());
  const nstClientRef = React.useRef<NstrumentaBrowserClient>();
  const [facingMode, setFacingMode] = React.useState(FACING_MODE_USER);
  const [detections, setDetections] = React.useState<Array<Detection>>([]);

  const capture = React.useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;
    const data = imageSrc.split(",")[1];
    const imageTag = uuidv4();
    nstClientRef.current?.send("preprocessing", {
      data,
      responseChannel,
      imageTag,
    });
  }, [webcamRef]);

  const discord = React.useCallback(() => {
    if (discordStatus === "true") {
      setDiscordStatus("false");
    }
    if (discordStatus === "false" || discordStatus === null) {
      setDiscordStatus("true");
    }
  }, []);

  React.useEffect(() => {
    if (captureInterval && typeof captureInterval !== "string") {
      const interval = setInterval(() => {
        capture();
      }, captureInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [captureInterval]);

  const svgScalingWidth = (value: number) => {
    return webcamContainerRef.current
      ? `${(100 * value) / webcamContainerRef.current.offsetWidth}%`
      : "100%";
  };
  const svgScalingHeight = (value: number) => {
    return webcamContainerRef.current
      ? `${(100 * value) / webcamContainerRef.current?.offsetHeight}%`
      : "100%";
  };

  const handleClick = React.useCallback(() => {
    setFacingMode((prevState) =>
      prevState === FACING_MODE_USER
        ? FACING_MODE_ENVIRONMENT
        : FACING_MODE_USER
    );
  }, []);

  const { search } = window.location;

  React.useEffect(() => {
    const wsUrlParam = new URLSearchParams(search).get("wsUrl");
    const wsUrl = wsUrlParam
      ? wsUrlParam
      : window.location.origin.replace("http", "ws");
    const apiKeyParam = new URLSearchParams(search).get("apiKey");
    if (apiKeyParam) {
      localStorage.setItem("apiKey", apiKeyParam);
    }

    const apiLocalStore = localStorage.getItem("apiKey") || "";
    const apiKey = apiKeyParam ? apiKeyParam : apiLocalStore;

    nstClientRef.current = new NstrumentaBrowserClient();

    nstClientRef.current.addListener("open", () => {
      nstClientRef.current?.addSubscription(responseChannel, (response) => {
        const stdout = response.stdout;
        console.log(stdout);
        const lines = stdout.split("\n");
        const newDetections: Array<Detection> = [];
        const resultIndex = lines.findIndex(
          (line: string) => line == "-------RESULTS--------"
        );
        for (let i = resultIndex + 1; i + 3 < lines.length; i += 4) {
          const score = Number(lines[i + 2].split(":")[1]) * 100;
          const label = `${lines[i]}`;
          const imageTag = response.imageTag;
          const regex = /[0-9]+/g;
          const [xmin, ymin, xmax, ymax] = lines[i + 3]
            .match(regex)
            .map(Number);
          newDetections.push({
            score,
            label,
            imageTag,
            xmin,
            xmax,
            ymin,
            ymax,
          });
        }
        setDetections(newDetections);

        const labels = newDetections.map((detection) => detection.label);
        const imageTag = response.imageTag;

        if (occupation === "present" && !labels.includes("person")) {
          occupation = "empty";
        }
        if (
          discordStatus === "true" &&
          labels.includes("person") &&
          occupation === "empty"
        ) {
          nstClientRef.current?.send("alert", imageTag);
          occupation = "present";
        }
      });
    });

    nstClientRef.current.connect({ wsUrl, apiKey });
  }, []);

  return (
    <>
      <div
        style={{
          display: "grid",
        }}
        ref={webcamContainerRef as LegacyRef<HTMLDivElement>}
      >
        <Webcam
          width={"100%"}
          audio={false}
          ref={webcamRef as LegacyRef<Webcam>}
          style={{
            gridRowStart: 1,
            gridColumnStart: 1,
            zIndex: 1,
          }}
          forceScreenshotSourceSize={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{
            ...videoConstraints,
            facingMode,
          }}
        />
        <svg
          style={{
            width: "100%",
            height: "100%",
            gridRowStart: 1,
            gridColumnStart: 1,
            zIndex: 2,
          }}
        >
          {detections.map((detection) => {
            const { xmin, xmax, ymin, ymax, label, score, imageTag } =
              detection;
            return (
              <>
                <rect
                  fill="none"
                  stroke="green"
                  strokeWidth="2px"
                  x={svgScalingWidth(xmin)}
                  y={svgScalingHeight(ymin)}
                  width={svgScalingWidth(xmax - xmin)}
                  height={svgScalingHeight(ymax - ymin)}
                />
                <text
                  x={svgScalingWidth(xmin + 3)}
                  y={svgScalingHeight(ymin + 20)}
                  fill="green"
                >
                  {`${label} ${score.toFixed(0)}`}
                </text>
                <text
                  x={svgScalingWidth(3)}
                  y={svgScalingHeight(20)}
                  fill="green"
                >
                  {imageTag}
                </text>
              </>
            );
          })}
        </svg>
      </div>
      <Grid container spacing={2} direction={"row"}>
        <Switch
          onChange={discord}
          inputProps={{ "aria-label": "controlled" }}
        />
      </Grid>
      <Grid container spacing={2} direction={"row"}>
        <Grid item>
          <InputLabel id="select-label">Interval</InputLabel>
          <Select
            labelId="select-label"
            id="select"
            value={captureInterval}
            label="Interval"
            onChange={(e) => {
              setCaptureInterval(e.target.value);
            }}
          >
            <MenuItem value="off">off</MenuItem>
            <MenuItem value={0.5}>0.5s</MenuItem>
            <MenuItem value={1}>1s</MenuItem>
            <MenuItem value={2}>2s</MenuItem>
          </Select>
        </Grid>
        <Grid item>
          <Button color="inherit" variant="outlined" onClick={handleClick}>
            Switch View
          </Button>
        </Grid>
        <Grid item>
          <Button color="inherit" variant="outlined" onClick={capture}>
            Capture photo
          </Button>
        </Grid>
      </Grid>
    </>
  );
};

export default Camera;
