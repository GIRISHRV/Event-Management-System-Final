-- ============================================================================
-- BACKFILL SCRIPT: Add venue_latitude and venue_longitude to existing events
-- ============================================================================
-- This script updates all existing events with coordinates based on their city.
-- Coordinates are derived from city centers to enable map visualization.
-- Run this ONCE after deploying the seed_full_demo.sql changes.
-- ============================================================================

-- Create helper functions if they don't exist
CREATE OR REPLACE FUNCTION get_city_latitude(city TEXT) RETURNS FLOAT AS $$
BEGIN
  RETURN CASE city
    WHEN 'Mumbai' THEN 19.0760
    WHEN 'Delhi' THEN 28.7041
    WHEN 'Bangalore' THEN 12.9716
    WHEN 'Hyderabad' THEN 17.3850
    WHEN 'Chennai' THEN 13.0827
    WHEN 'Kolkata' THEN 22.5726
    WHEN 'Pune' THEN 18.5204
    WHEN 'Ahmedabad' THEN 23.0225
    WHEN 'Jaipur' THEN 26.9124
    WHEN 'Surat' THEN 21.1702
    WHEN 'Lucknow' THEN 26.8467
    WHEN 'Kanpur' THEN 26.4499
    WHEN 'Nagpur' THEN 21.1458
    WHEN 'Indore' THEN 22.7196
    WHEN 'Bhopal' THEN 23.1815
    WHEN 'Patna' THEN 25.5941
    WHEN 'Vadodara' THEN 22.3072
    WHEN 'Ludhiana' THEN 30.9010
    WHEN 'Agra' THEN 27.1767
    WHEN 'Nashik' THEN 19.9975
    WHEN 'Faridabad' THEN 28.4089
    WHEN 'Meerut' THEN 28.9845
    WHEN 'Rajkot' THEN 22.3039
    WHEN 'Varanasi' THEN 25.3176
    WHEN 'Coimbatore' THEN 11.0066
    WHEN 'Kochi' THEN 9.9312
    WHEN 'Thiruvananthapuram' THEN 8.5241
    WHEN 'Vijayawada' THEN 16.5062
    WHEN 'Visakhapatnam' THEN 17.6869
    WHEN 'Mysuru' THEN 12.2958
    WHEN 'Hubli' THEN 15.3647
    WHEN 'Mangalore' THEN 12.8628
    WHEN 'Chandigarh' THEN 30.7333
    WHEN 'Amritsar' THEN 31.6340
    WHEN 'Jalandhar' THEN 31.8255
    WHEN 'Dehradun' THEN 30.3165
    WHEN 'Shimla' THEN 31.7724
    WHEN 'Haridwar' THEN 29.9457
    WHEN 'Rishikesh' THEN 30.0889
    WHEN 'Guwahati' THEN 26.1445
    WHEN 'Bhubaneswar' THEN 20.2961
    WHEN 'Cuttack' THEN 20.4625
    WHEN 'Ranchi' THEN 23.3441
    WHEN 'Raipur' THEN 21.2514
    WHEN 'Gwalior' THEN 26.2183
    WHEN 'Jabalpur' THEN 23.1815
    WHEN 'Ujjain' THEN 23.1815
    WHEN 'Jodhpur' THEN 26.2389
    WHEN 'Udaipur' THEN 24.5854
    WHEN 'Ajmer' THEN 26.4499
    ELSE 20.5937  -- India center fallback
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_city_longitude(city TEXT) RETURNS FLOAT AS $$
BEGIN
  RETURN CASE city
    WHEN 'Mumbai' THEN 72.8479
    WHEN 'Delhi' THEN 77.1025
    WHEN 'Bangalore' THEN 77.5945
    WHEN 'Hyderabad' THEN 78.4867
    WHEN 'Chennai' THEN 80.2707
    WHEN 'Kolkata' THEN 88.3639
    WHEN 'Pune' THEN 73.8567
    WHEN 'Ahmedabad' THEN 72.5714
    WHEN 'Jaipur' THEN 75.7873
    WHEN 'Surat' THEN 72.8311
    WHEN 'Lucknow' THEN 80.9462
    WHEN 'Kanpur' THEN 80.3336
    WHEN 'Nagpur' THEN 79.0882
    WHEN 'Indore' THEN 75.8577
    WHEN 'Bhopal' THEN 77.4126
    WHEN 'Patna' THEN 85.1376
    WHEN 'Vadodara' THEN 73.1812
    WHEN 'Ludhiana' THEN 75.8573
    WHEN 'Agra' THEN 78.0081
    WHEN 'Nashik' THEN 73.7997
    WHEN 'Faridabad' THEN 77.3178
    WHEN 'Meerut' THEN 77.7064
    WHEN 'Rajkot' THEN 70.8022
    WHEN 'Varanasi' THEN 82.9711
    WHEN 'Coimbatore' THEN 76.9558
    WHEN 'Kochi' THEN 76.2673
    WHEN 'Thiruvananthapuram' THEN 76.9366
    WHEN 'Vijayawada' THEN 80.6428
    WHEN 'Visakhapatnam' THEN 83.2185
    WHEN 'Mysuru' THEN 75.7139
    WHEN 'Hubli' THEN 75.1394
    WHEN 'Mangalore' THEN 74.8479
    WHEN 'Chandigarh' THEN 76.7794
    WHEN 'Amritsar' THEN 74.8723
    WHEN 'Jalandhar' THEN 75.5761
    WHEN 'Dehradun' THEN 78.0322
    WHEN 'Shimla' THEN 77.1734
    WHEN 'Haridwar' THEN 78.1198
    WHEN 'Rishikesh' THEN 78.2676
    WHEN 'Guwahati' THEN 91.7898
    WHEN 'Bhubaneswar' THEN 85.8830
    WHEN 'Cuttack' THEN 85.8945
    WHEN 'Ranchi' THEN 85.3271
    WHEN 'Raipur' THEN 81.6296
    WHEN 'Gwalior' THEN 78.1694
    WHEN 'Jabalpur' THEN 79.5941
    WHEN 'Ujjain' THEN 75.7850
    WHEN 'Jodhpur' THEN 73.0243
    WHEN 'Udaipur' THEN 73.7125
    WHEN 'Ajmer' THEN 74.6399
    ELSE 78.9629  -- India center fallback
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Backfill venue coordinates for all existing events
UPDATE events
SET 
  venue_latitude = get_city_latitude(venue_city),
  venue_longitude = get_city_longitude(venue_city),
  updated_at = NOW()
WHERE venue_latitude IS NULL 
  AND venue_longitude IS NULL 
  AND venue_city IS NOT NULL;

-- Report results
DO $$
DECLARE
  updated_count INT;
BEGIN
  SELECT COUNT(*) INTO updated_count 
  FROM events 
  WHERE venue_latitude IS NOT NULL 
    AND venue_longitude IS NOT NULL;
  
  RAISE NOTICE 'Backfill complete: % events now have venue coordinates', updated_count;
END;
$$;
