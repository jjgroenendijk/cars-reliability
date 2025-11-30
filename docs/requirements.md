# Requirements

When downloading a dataset, the entire dataset should be downloaded as is. Selecting which columns are needed in advance is not allowed, all data has to downloaded as is for the datasets.

When downloading the dataset, it is mandatory to download the complete dataset without filtering. The only allowed filter is `voertuigsoort='Personenauto'` on the vehicles dataset to exclude work trucks.

The github actions workflow has to have 3 parts:
    - Dataset download or update check.
        - Check if update is available. Compare to current available data in github cache. Update if RDW has new data.
    - Data processing
    - Website processing and uploading.

Changes always have to be tested on the main branch. Success can only be claimed if the main branch shows success in the github actions logs.

Sample percentage:
    - Default: 100% (full dataset)
    - Can be adjusted via workflow_dispatch input (1%, 10%, 50%, 100%)
    - Use lower percentages for quick testing
