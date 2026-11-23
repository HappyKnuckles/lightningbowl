# OpenCV.js bindings for Lightning Bowl's shot analysis: what the app calls, plus a few basics.
# Binding list for scripts/opencv/build.sh. The app can only call the OpenCV functions listed here.
core = {
    '': [
        'absdiff', 'add', 'addWeighted', 'bitwise_and', 'bitwise_not', 'bitwise_or', 'bitwise_xor', 'compare',
        'convertScaleAbs', 'copyMakeBorder', 'countNonZero', 'flip', 'hconcat', 'inRange', 'invert', 'max', 'mean',
        'meanStdDev', 'merge', 'min', 'minMaxLoc', 'multiply', 'norm', 'normalize', 'perspectiveTransform', 'reduce',
        'rotate', 'split', 'subtract', 'transpose', 'vconcat', 'setLogLevel', 'getLogLevel', 'LUT',
    ],
    'Algorithm': [],
}

imgproc = {
    '': [
        'blur', 'boundingRect', 'calcHist', 'Canny', 'circle', 'connectedComponents', 'connectedComponentsWithStats',
        'createCLAHE', 'cvtColor', 'dilate', 'equalizeHist', 'erode', 'fillConvexPoly', 'fillPoly', 'findContours',
        'GaussianBlur', 'getPerspectiveTransform', 'getStructuringElement', 'goodFeaturesToTrack', 'HoughLinesP',
        'integral', 'line', 'matchTemplate', 'medianBlur', 'minEnclosingCircle', 'moments', 'morphologyEx', 'polylines',
        'putText', 'pyrDown', 'pyrUp', 'rectangle', 'remap', 'resize', 'Scharr', 'Sobel', 'threshold', 'warpAffine',
        'warpPerspective',
    ],
    'CLAHE': ['apply', 'collectGarbage', 'getClipLimit', 'getTilesGridSize', 'setClipLimit', 'setTilesGridSize'],
}

video = {
    '': ['calcOpticalFlowPyrLK', 'createBackgroundSubtractorMOG2'],
    'BackgroundSubtractorMOG2': ['BackgroundSubtractorMOG2', 'apply'],
    'BackgroundSubtractor': ['apply', 'getBackgroundImage'],
}

features2d = {
    'Feature2D': ['detect', 'compute', 'detectAndCompute', 'descriptorSize', 'descriptorType', 'defaultNorm', 'empty', 'getDefaultName'],
    'ORB': ['create', 'setMaxFeatures', 'setScaleFactor', 'setNLevels', 'setEdgeThreshold', 'setFastThreshold', 'setFirstLevel', 'setWTA_K', 'setScoreType', 'setPatchSize', 'getFastThreshold', 'getDefaultName'],
    'DescriptorMatcher': ['add', 'clear', 'empty', 'isMaskSupported', 'train', 'match', 'knnMatch', 'radiusMatch', 'clone', 'create'],
    'BFMatcher': ['isMaskSupported', 'create'],
}

white_list = makeWhiteList([core, imgproc, video, features2d])
