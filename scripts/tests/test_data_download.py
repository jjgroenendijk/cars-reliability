from data_download import KENTEKEN_DATASETS, KENTEKEN_PREFIXES, csv_shards_get


def test_csv_shards_get_non_kenteken():
    """Test csv_shards_get for a dataset ID not in KENTEKEN_DATASETS."""
    dataset_id = "non_existent_dataset"
    assert dataset_id not in KENTEKEN_DATASETS
    shards = csv_shards_get(dataset_id)
    assert shards == [("full", None)]


def test_csv_shards_get_kenteken():
    """Test csv_shards_get for a dataset ID in KENTEKEN_DATASETS."""
    dataset_id = next(iter(KENTEKEN_DATASETS))
    assert dataset_id in KENTEKEN_DATASETS
    shards = csv_shards_get(dataset_id)
    assert len(shards) == len(KENTEKEN_PREFIXES)
    for prefix in KENTEKEN_PREFIXES:
        expected_shard = (f"kenteken_{prefix}", f"starts_with(kenteken, '{prefix}')")
        assert expected_shard in shards
