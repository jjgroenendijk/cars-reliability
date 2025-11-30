# Requirements

When downloading a dataset, the entire dataset should be downloaded as is. Selecting which columns are needed in advance is not allowed, all data has to downloaded as is for the datasets.

The github actions workflow has to have 3 parts:
    - Dataset download or update check.
        - Check if update is available. Compare to current available data in github cache. Update if RDW has new data.
    - Data processing
    - Website processing and uploading.

Changes always have to be tested on the dev branch. Success can only be claimed if the dev branch shows success in the gihtub actions logs

Main branch and dev branch:
    - Main downloads 100% of the datasets.
    - Dev downloads 1% of the datasets
    - Both branches deploy to GitHub Pages (last deployment wins)
